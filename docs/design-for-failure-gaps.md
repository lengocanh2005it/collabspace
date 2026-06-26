# Design for Failure — Phân tích Gap

> Tài liệu này phân tích trung thực những gì dự án **đã làm tốt** và những gì **còn thiếu** trong tư duy Design for Failure.  
> Ngày đánh giá: 2026-06-25

> Cập nhật implementation: các gap **Circuit Breaker**, **HTTP sync retry**, **service-level rate limiting**, và **workspace membership cache invalidation** đã được implement sau đánh giá này. Bulkhead vẫn là trade-off được chấp nhận trong Node.js.

---

## Đã triển khai tốt ✅

| Cơ chế | Nơi áp dụng | Ghi chú |
|--------|-------------|---------|
| **Timeout** mọi sync call | `WorkspaceHttpClient`, `UserProfileHttpClient`, auth gRPC | `AbortController` + configurable `timeoutMs` |
| **Retry với exponential backoff** | Kafka consumer (tất cả service) | `retryWithBackoff()` trong `packages/shared` — fail N lần → DLQ |
| **Idempotency** Kafka consumer | notification, task, analytics | `ProcessedEvent.tryClaim(eventId)` trước khi xử lý |
| **Saga rollback** | auth-service đăng ký | gRPC sang user-service fail → xóa credential vừa tạo, không orphan data |
| **Fallback cho read model** | task-service, notification-service | Local replica → HTTP fallback → upsert vào replica, có metrics counter |
| **Health check phân tầng** | Tất cả 7 service | `liveness` (process alive) vs `readiness` (DB/Kafka connected) tách biệt |
| **Graceful shutdown** | Tất cả service có Kafka consumer | Disconnect sạch khi nhận SIGTERM, không drop message đang xử lý |
| **DLQ** | Toàn hệ thống | Message lỗi không bị bỏ rơi — lưu vào MongoDB, có API replay/discard |
| **Database HA** | PostgreSQL (CloudNativePG), MongoDB (Replica Set), Redis (Sentinel) | Tự động failover, drill đã kiểm chứng |
| **Outbox Pattern** | workspace, task, auth | Ghi sự kiện + dữ liệu trong cùng transaction — không mất event dù Kafka down |
| **Workspace membership cache** | task-service | Redis TTL 60s, negative cache 15s — tránh gọi HTTP mỗi request |

---

## Còn thiếu — Gap thực sự ⚠️

### 1. Circuit Breaker

**Vấn đề:**  
Hiện tại `WorkspaceHttpClient` và `UserProfileHttpClient` chỉ có timeout — không có circuit breaker. Nếu workspace-service bị chậm hoặc trả lỗi liên tục, task-service vẫn gọi đến hết timeout *mỗi request* trong suốt thời gian đó.

**Ví dụ cụ thể:**  
workspace-service bị chậm 2,900ms/req (gần timeout 3,000ms):
- Mỗi request tạo task mất 2,900ms chờ timeout
- 100 user đồng thời tạo task → 100 request treo 2,900ms
- Không có gì ngăn task-service tiếp tục gọi vào một service đang có vấn đề

**Giải pháp đúng — Circuit Breaker:**
```
CLOSED (bình thường) → 5 lỗi liên tiếp → OPEN (fail-fast, không gọi nữa)
                                              ↓ sau 30s
                                           HALF-OPEN (thử 1 request)
                                              ↓ thành công
                                           CLOSED (khôi phục)
```

**Cách implement trong NestJS:**  
Dùng thư viện `opossum` qua helper shared để các service dùng cùng một policy:
```typescript
import { CircuitBreaker } from '@collabspace/shared';

const breaker = new CircuitBreaker('workspace-service', {
  failureThreshold: 5,     // 5 lỗi liên tiếp → OPEN
  resetTimeoutMs: 30000,   // thử lại sau 30s
});

await breaker.execute(fetchMembership);
```

**Mức độ quan trọng:** Cao — đây là pattern cơ bản của resilience trong microservices, thường xuất hiện trong câu hỏi về kiến trúc.

---

### 2. Retry cho HTTP sync call

**Vấn đề:**  
`WorkspaceHttpClient.fetchMembership()` và `UserProfileHttpClient` timeout rồi throw `ServiceUnavailableException` ngay, không thử lại. Một blip mạng 100ms sẽ fail request của người dùng dù workspace-service hoàn toàn bình thường.

**Code hiện tại:**
```typescript
// WorkspaceHttpClient — không có retry
const response = await fetch(url, { signal: controller.signal });
// nếu lỗi → throw luôn
```

**Giải pháp:**  
Thêm retry 1–2 lần với delay ngắn cho transient error (network blip), nhưng **không** retry 4xx (lỗi do client, retry vô ích):
```typescript
// Chỉ retry 5xx và network error, không retry 401/403/404
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  const response = await fetch(url, { signal });
  if (response.ok || response.status < 500) return response;
  if (attempt < maxRetries) await sleep(retryDelayMs * (attempt + 1));
}
```

**Lưu ý:** Không kết hợp retry mạnh với timeout ngắn — 3 lần retry × 3s timeout = 9s chờ, quá lâu cho người dùng.

**Mức độ quan trọng:** Trung bình — giải quyết transient failure, quan trọng với môi trường K8s nơi pod restart thường xuyên.

---

### 3. Rate Limiting ở service level

**Vấn đề:**  
Chỉ có OTP resend cooldown (429) trong auth-service. Các endpoint khác không có throttling ở tầng service — một client gọi liên tục 1,000 req/s vào `POST /api/v1/tasks` sẽ không bị chặn ở task-service.

**Hiện tại:** Traefik có thể cấu hình rate limit nhưng chưa rõ đã bật chưa. Kể cả đã bật ở gateway, service vẫn nên tự bảo vệ theo nguyên tắc defense in depth.

**Giải pháp trong NestJS:**  
`@nestjs/throttler` — cài đặt đơn giản:
```typescript
// app.module.ts
ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]) // 100 req/phút/IP

// Controller
@Throttle({ default: { limit: 20, ttl: 60000 } })
@Post()
async createTask() { ... }
```

**Mức độ quan trọng:** Trung bình — quan trọng cho production, ít ảnh hưởng đến demo.

---

### 4. Bulkhead (tách biệt connection pool)

**Vấn đề:**  
Node.js single-threaded nên không có thread pool để isolate, nhưng connection pool đến các dependency (MongoDB, Redis, HTTP) dùng chung event loop. Nếu MongoDB query chậm gây backpressure và làm đầy pending queue, các request HTTP sang workspace-service cũng bị delay theo dù không liên quan MongoDB.

**Ví dụ:**  
task-service xử lý 100 request đang chờ MongoDB → event loop bận → request kiểm tra workspace membership (HTTP, không cần MongoDB) cũng bị delay.

**Trong thực tế với Node.js:**  
Bulkhead thuần không áp dụng được như Java. Cách tiếp cận thực tế là:
- Đặt `connectionPoolSize` hợp lý cho Mongoose (mặc định 5, có thể tăng)
- Dùng `timeout` ngắn cho HTTP call để không block lâu
- Tách Kafka consumer chạy độc lập với HTTP handler (đã làm — consumer là NestJS lifecycle hook riêng)

**Mức độ quan trọng:** Thấp trong bối cảnh Node.js — khó implement thật sự, thường là trade-off chấp nhận được.

---

### 5. Workspace Membership Cache — Thiếu invalidation

**Vấn đề:**  
`WorkspaceMembershipCacheService` hoạt động đúng (TTL 60s, negative cache 15s, Redis) nhưng **không có invalidation chủ động** khi quyền thành viên thay đổi.

**Tình huống nguy hiểm:**
1. Admin kick user B ra khỏi workspace lúc 10:00:00
2. User B tạo task lúc 10:00:30 → task-service đọc cache → cache vẫn nói B là member ✅
3. B tạo task thành công dù đã bị kick — **sai về business logic**
4. Cache hết hạn lúc 10:01:00 → lần sau mới đúng

**Code hiện tại:**
```typescript
// WorkspaceMembershipCacheService có clear() method
async clear(workspaceId?: string, userId?: string): Promise<void> { ... }

// Nhưng không ai gọi clear() khi workspace_member_removed
```

**Giải pháp:**  
Khi workspace-service phát sự kiện canonical `workspace.member_left` lên Kafka topic `collabspace.workspace.member_left`, task-service lắng nghe và gọi `membershipCache.clear(workspaceId, userId)`. Task-service đã có consumer workspace events lắng nghe `workspace_deleted`; bổ sung subscribe topic `member_left` trong cùng consumer group.

**Mức độ quan trọng:** Cao về correctness — đây là lỗi logic thật, không chỉ là performance gap.

---

## Tổng hợp

| Gap | Mức độ | Khó implement | Phù hợp fix trong dự án này |
|-----|--------|---------------|------------------------------|
| Circuit Breaker | Cao | Trung bình | ✅ Đã làm |
| Retry HTTP sync | Trung bình | Thấp | ✅ Đã làm |
| Rate Limiting | Trung bình | Thấp | ✅ Đã làm |
| Bulkhead | Thấp | Cao (Node.js không support tốt) | ⚠️ Biết nhưng chấp nhận |
| Cache invalidation | Cao | Thấp (thêm Kafka consumer handler) | ✅ Đã làm |

> **Kết luận:** Dự án đã xây dựng tốt tầng data resilience (outbox, DLQ, saga, idempotency) và infrastructure HA (CloudNativePG, MongoDB RS, Redis Sentinel). Tầng giao tiếp sync giữa service (circuit breaker, retry, cache invalidation) còn là gap thực sự — đây là vùng có thể cải thiện rõ ràng trong bước tiếp theo.

---

> 📄 Liên quan: `docs/resilience-overview.md`, `.claude/docs/resilience.md`, `docs/production-hardening.md`

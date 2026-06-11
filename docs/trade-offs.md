# CollabSpace — Architecture trade-offs

Tài liệu ghi **quyết định kiến trúc**, **lợi ích**, **cái giá phải trả**, và **khi nào nên chọn cách khác**. CollabSpace là dự án demo/học microservices — trade-off ưu tiên **minh bạch và end-to-end**, không tối ưu cost/latency production tuyệt đối.

Tài liệu liên quan:

| Chủ đề | File |
|--------|------|
| NFRs / chất lượng | [nfrs.md](./nfrs.md) |
| Dữ liệu xuyên service | [cross-service-data.md](./cross-service-data.md) |
| Chịu lỗi | [resilience-overview.md](./resilience-overview.md) |
| Read model pattern | [`.claude/docs/read-models.md`](../.claude/docs/read-models.md) |
| Production gaps | [production-hardening.md](./production-hardening.md) |

---

## 1. Microservices vs monolith

| | Microservices (CollabSpace) | Monolith |
|---|---------------------------|----------|
| **Chọn** | ✅ 5 service + gateway + message bus | |
| **Gain** | Ranh giới rõ; deploy/scale từng phần; học sync/async, resilience thật | |
| **Cost** | Vận hành phức tạp; debug xuyên service; duplicate schema (replica); không có JOIN | |
| **Khi đổi** | Team nhỏ, MVP chưa validate — monolith hoặc modular monolith nhanh hơn | |

**Lý do dự án:** mục tiêu học/demo kiến trúc phân tán, không phải ship nhanh nhất một codebase.

---

## 2. Database per service vs shared database

| | DB riêng (CollabSpace) | Shared DB |
|---|------------------------|-----------|
| **Chọn** | ✅ Postgres/Mongo tách theo service | |
| **Gain** | Encapsulation; scale schema độc lập; không lock chéo migration | |
| **Cost** | Không JOIN; cần replica/event/sync; eventual consistency | |
| **Khi đổi** | Báo cáo cross-domain nặng, team chưa sẵn sàng event — tạm shared read replica hoặc monolith DB | |

Chi tiết: [cross-service-data.md](./cross-service-data.md)

---

## 3. Local replica + event vs gọi sync mỗi request

| | Replica + RabbitMQ | HTTP/gRPC mỗi lần đọc |
|---|-------------------|------------------------|
| **Chọn (user data)** | ✅ `user_replicas` + fallback | |
| **Chọn (membership)** | | ✅ HTTP workspace mỗi mutation |
| **Gain (replica)** | Nhanh; user-service không bottleneck; task/notification tự chủ read path | |
| **Cost (replica)** | Lag sync; schema duplicate; consumer + DLQ + fallback | |
| **Gain (sync)** | Luôn đúng ngay — phù hợp authorization | |
| **Cost (sync)** | Latency; cascade failure nếu peer down (mitigate bằng timeout/503) | |

**Quy tắc CollabSpace:** đọc user **nhiều** → replica; **quyền / membership** → sync.

---

## 4. Eventual consistency vs strong consistency

| | Eventual (replica, outbox delivery) | Strong (local TX, sync verify) |
|---|-------------------------------------|--------------------------------|
| **Chọn** | ✅ Mention, actor name, notification enrich | ✅ Register saga step, workspace guard |
| **Gain** | Throughput; loose coupling; chịu partition tốt hơn | UX đúng ngay; ít surprise |
| **Cost** | User vừa đổi tên — mention có thể lag vài trăm ms | Tight coupling; dependency down → 503 |
| **Giảm cost** | `occurredAt` + metric lag; fallback hydrate | Timeout 3s + degradation matrix |

---

## 5. Transactional outbox vs publish trực tiếp sau DB

| | Outbox (CollabSpace) | Fire-and-forget publish |
|---|---------------------|-------------------------|
| **Chọn** | ✅ auth email, workspace invite, task assign events | |
| **Gain** | Không mất event nếu broker down lúc commit; retry có kiểm soát | |
| **Cost** | Bảng outbox; processor; lag delivery; code phức tạp hơn | |
| **Khi đổi** | Event không critical, mất một message chấp nhận được — publish trực tiếp (user-service warn-only publish profile event) | |

---

## 6. At-least-once + idempotency vs exactly-once

| | At-least-once + dedupe (CollabSpace) | Exactly-once end-to-end |
|---|--------------------------------------|-------------------------|
| **Chọn** | ✅ RabbitMQ + `eventId` dedupe; `Idempotency-Key` HTTP | |
| **Gain** | Đơn giản với RabbitMQ; phù hợp demo | |
| **Cost** | Consumer phải idempotent; duplicate window; storage dedupe | |
| **Khi đổi** | Kafka transactions / DB outbox + inbox pattern nếu cần exactly-once nghiêm | |

---

## 7. PostgreSQL vs MongoDB trong cùng hệ

| Store | Service | Trade-off |
|-------|---------|-----------|
| **Postgres** | auth, user, workspace | ACID, relation trong service; TypeORM/Flyway quen thuộc |
| **Mongo** | task, notification | Linh hoạt schema; CQRS/event stream task; document notification |

| Gain | Cost |
|------|------|
| Chọn đúng model từng bounded context | Ops 2 loại DB; backup/restore khác nhau ([backup-policy.md](./backup-policy.md)) |
| Task event sourcing tự nhiên trên document | Không SQL report cross-service |

**Không** dùng Mongo cho mọi thứ — identity/workspace cần transaction rõ ràng.

---

## 8. gRPC vs HTTP giữa services

| Kết nối | Giao thức | Lý do |
|---------|-----------|-------|
| auth ↔ user (verify, profile) | **gRPC** | Nội bộ, typed, latency thấp |
| task → workspace (membership) | **HTTP** | Đơn giản demo; dễ curl/debug |
| Client → app | **HTTP** qua Traefik | Chuẩn REST/OpenAPI |

| gRPC gain | gRPC cost |
|-----------|-----------|
| Contract protobuf; hiệu năng | Tooling, load balancer, debug khó hơn HTTP |

**Trade-off:** HTTP task→workspace đổi lấy simplicity; prod có thể chuyển gRPC + client stub.

---

## 9. API Gateway (Traefik) vs BFF per client

| | Central gateway (CollabSpace) | BFF riêng mobile/web |
|---|------------------------------|----------------------|
| **Chọn** | ✅ Traefik + forward-auth + rate limit | |
| **Gain** | Một điểm auth, routing, retry/CB | |
| **Cost** | Gateway thành single hop phụ thuộc; không tailor response per client | |
| **Khi đổi** | Nhiều client UX khác biệt — BFF aggregate GraphQL/REST | |

---

## 10. Trust boundaries — layered defense (Phase B)

| Layer | Cơ chế | Trade-off |
|-------|--------|-----------|
| **B1** Service `AuthGuard` + auth gRPC | Không tin `X-User-Id` từ client | Thêm hop gRPC mỗi request; timeout 3s |
| **B2** Gateway `strip-identity-headers` | Xóa header giả trước forward-auth | Defense in depth; service vẫn verify JWT |
| **B3** `INTERNAL_SERVICE_TOKEN` S2S | task→workspace membership, replica fallback | Shared secret; chưa mTLS mesh |
| **B4** NetworkPolicy + gateway block internal paths | Pod chỉ nhận traffic cần thiết | CNI phải hỗ trợ; local Helm có thể `networkPolicies.enabled: false` |

**Chọn:** cả bốn lớp cho demo an toàn hơn mà không đổi contract public API.

---

## 10.1 Correlation ID — `X-Request-Id` (Phase C)

| | Propagate request ID (CollabSpace) | Không có correlation |
|---|-----------------------------------|----------------------|
| **Chọn** | ✅ Middleware 5 services + S2S HTTP forward | |
| **Gain** | Tra cứu log/response theo một ID; gateway → auth verify → downstream | |
| **Cost** | Chưa inject `requestId` vào mọi log line; gRPC chưa carry metadata | |
| **Infra tiếp** | ELK/Loki parse field; optional OTel trace link | |

Chi tiết: `.claude/docs/service-contracts.md` → Correlation ID.

---

## 11. JWT + forward-auth vs session server-side only

| | JWT access + refresh (CollabSpace) | Server session cookie |
|---|-----------------------------------|----------------------|
| **Gain** | Stateless app tier; scale horizontal dễ hơn | |
| **Cost** | Revoke phải quản lý refresh token; secret rotation | |
| **Mitigate** | Redis refresh tokens; change password revoke all | |

---

## 12. CQRS + event sourcing (task) vs CRUD (các service khác)

| | Task: ES + projection | Workspace/user: CRUD + outbox |
|---|----------------------|-------------------------------|
| **Gain** | Audit trail task; mô hình domain phong phú | Đơn giản; time-to-demo nhanh |
| **Cost** | Learning curve; 2 model read/write; migration legacy projection | |
| **Khi đổi** | Task chỉ CRUD đủ demo — bỏ ES giảm complexity | |

**Trade-off có chủ ý:** một service “nặng” để học pattern, còn lại giữ CRUD.

---

## 13. Denormalize trong event vs luôn tra replica

| | Cả hai (CollabSpace notification) | Chỉ replica |
|---|-----------------------------------|-------------|
| **Lúc ghi** | Payload mang `actorName`, `taskTitle` → metadata | |
| **Lúc đọc** | List API ưu tiên `user_replicas` | |
| **Gain** | Notification vẫn hiển thị được nếu replica lag; list cập nhật tên mới | |
| **Cost** | Dữ liệu trùng 3 chỗ (event, metadata, replica) | |

---

## 14. Observability stack đầy đủ vs minimal

| | Prometheus + Grafana + alerts + optional Jaeger/ELK | Chỉ logs stdout |
|---|------------------------------------------------------|-----------------|
| **Chọn** | ✅ Stack trong `infrastructure/` | |
| **Gain** | Debug prod-like; drill resilience | |
| **Cost** | RAM local Docker; cấu hình datasource/UID | |
| **Trade-off demo** | Bật tracing/logging profile khi cần, không bắt buộc mọi lúc | |

---

## 15. Helm/K8s vs chỉ Docker Compose

| | Cả hai | Chỉ Compose |
|---|--------|-------------|
| **Gain** | Học deploy prod-like; PDB, probes, secrets pattern | |
| **Cost** | Manifest/chart maintenance; cluster requirement | |
| **CollabSpace** | Compose cho dev nhanh; Helm cho “path to prod” | |

---

## 16. Demo scope vs production completeness

| Ưu tiên demo | Cố ý chưa làm / làm một phần |
|--------------|------------------------------|
| Luồng 7 bước MVP (API) | Frontend UI; script E2E tự động |
| Resilience 0–4, Phase B/C | SLO p99, multi-region |
| Read model user | mTLS mesh, workspace replica |
| Activity feed | WebSocket realtime |
| Seed thống nhất | — |
| Infra vận hành | Backup cron, restore drill, Secret Manager, CI/CD — [phan-phu-tho-infrastructure-backlog.md](./team/phan-phu-tho-infrastructure-backlog.md) |

Xem checklist: [production-hardening.md](./production-hardening.md), [nfrs.md](./nfrs.md), [mvp-demo-scope.md](./mvp-demo-scope.md).

---

## Ma trận quyết định nhanh (cho feature mới)

```
Cần đọc data service B thường xuyên?
  ├─ Có → local read model + event (+ fallback)
  └─ Không → sync call hoặc embed trong event một lần

Cần đúng 100% lúc request (quyền, tiền, inventory)?
  └─ Sync call + timeout + 503, KHÔNG replica

Ghi DB + gửi event?
  └─ Transactional outbox (hoặc inbox consumer)

Message có thể duplicate?
  └─ Idempotency key (HTTP) hoặc eventId dedupe (consumer)

Side effect có được fail im lặng?
  ├─ Critical path → fail loud + rollback/saga
  └─ Enrichment → degrade có document
```

---

## Tóm tắt triết lý CollabSpace

1. **Chấp nhận complexity vận hành** để học boundary thật giữa services.
2. **Không giả vờ strong consistency mọi nơi** — chọn đúng chỗ sync vs eventual.
3. **Outbox + idempotency** thay vì exactly-once magic.
4. **Gateway + contract docs** giảm chaos tích hợp.
5. **Production** = demo + checklist hardening — không claim enterprise day one.

Khi review PR kiến trúc: hỏi *“trade-off này đã ghi trong doc chưa?”* — nếu chưa, cập nhật file này hoặc [cross-service-data.md](./cross-service-data.md) / [resilience.md](../.claude/docs/resilience.md).

# CollabSpace — Non-Functional Requirements (NFRs)

Tài liệu mô tả **thuộc tính chất lượng** (quality attributes) mà dự án CollabSpace **nhắm tới và đã có cơ sở trong code/infra**. Đây là nền tảng demo/học microservices — **không phải cam kết SLA production** trừ khi ghi rõ.

Chi tiết kỹ thuật:

| Chủ đề | Tài liệu |
|--------|----------|
| Chịu lỗi, degradation | [resilience-overview.md](./resilience-overview.md), [`.claude/docs/resilience.md`](../.claude/docs/resilience.md) |
| Dữ liệu xuyên service | [cross-service-data.md](./cross-service-data.md) |
| Production checklist | [production-hardening.md](./production-hardening.md) |
| Backup RPO/RTO | [backup-policy.md](./backup-policy.md) |
| Trade-offs kiến trúc | [trade-offs.md](./trade-offs.md) |

**Ký hiệu trạng thái**

| Ký hiệu | Ý nghĩa |
|---------|---------|
| ✅ | Có trong repo, dùng được (demo/local/staging) |
| ⚠️ | Có một phần; cần cấu hình/vận hành thêm cho prod |
| 📋 | Đã document / checklist; chưa tự động hóa đầy đủ |
| ❌ | Ngoài phạm vi MVP demo |

---

## 1. Availability & reliability (Khả dụng)

| NFR | Mục tiêu | CollabSpace |
|-----|----------|-------------|
| Health phân tầng | Phân biệt process sống vs sẵn sàng nhận traffic | ✅ `/health/live`, `/health/ready` trên 5 app services; `503` khi dependency required down |
| Loại traffic khi chưa ready | LB/gateway không gửi request vào instance unhealthy | ✅ Traefik health check; K8s readiness probe (Helm/k8s manifests) |
| Graceful shutdown | Giảm request bị cắt khi deploy | ✅ `preStop` + `terminationGracePeriodSeconds` (K8s/Helm) |
| Single-instance demo | Chạy end-to-end trên Docker Compose | ✅ |
| Multi-AZ / HA datastore | Uptime 99.9%+ | ❌ Demo — DB thường single instance; prod dùng managed DB + HA |

---

## 2. Resilience & fault tolerance (Chịu lỗi)

| NFR | Mục tiêu | CollabSpace |
|-----|----------|-------------|
| Timeout mọi gọi sync nội bộ | Không treo thread vô hạn | ✅ gRPC/HTTP client ~3s (auth↔user, task→workspace) |
| Lỗi dependency → HTTP rõ ràng | `503` + `code` ổn định, không `500` mù | ✅ Ma trận degradation (`.claude/docs/resilience.md` §4) |
| Circuit breaker / retry ở edge | Giảm cascade khi downstream chết | ✅ Traefik retry + circuit breaker |
| Saga / bù trừ | Không orphan data khi bước giữa fail | ✅ Register rollback; outbox cho side effects |
| Idempotent consumer | At-least-once event an toàn | ✅ Dedupe `eventId` (notification); `Idempotency-Key` (workspace/task) |
| Degrade có kiểm soát | Enrichment fail không làm hỏng luồng chính | ✅ `/auth/me` → `profileStatus: unavailable` |
| Chaos / drill | Kiểm chứng recovery | ⚠️ Script `verify-readiness.sh`, `chaos-stop-service.sh`; chưa CI định kỳ |
| Bulkhead / rate limit app | Chống overload từng luồng | ⚠️ Gateway rate-limit; OTP/resend cooldown (auth); chưa bulkhead pool đầy đủ |

---

## 3. Performance & scalability (Hiệu năng)

| NFR | Mục tiêu | CollabSpace |
|-----|----------|-------------|
| Local read model | Giảm gọi chéo service khi đọc nhiều | ✅ `user_replicas` + `UserReplicaLookupService` |
| Async event bus | Tách luồng ghi chính khỏi notification | ✅ RabbitMQ + outbox |
| Horizontal scale stateless apps | Nhiều replica app | ⚠️ K8s HPA templates có; chưa load test baseline |
| Connection pool / resource limits | Tránh OOM dưới tải | ⚠️ K8s requests/limits có; chưa tune theo benchmark |
| SLO / p99 latency | Cam kết ms cụ thể | ❌ Chưa định nghĩa SLO; có metric histogram HTTP |
| Caching | Giảm tải DB | ⚠️ Redis (auth OTP/session); chưa cache layer chung |

---

## 4. Security (Bảo mật)

| NFR | Mục tiêu | CollabSpace |
|-----|----------|-------------|
| Authentication | JWT access + refresh | ✅ auth-service |
| Authorization gateway | Protected routes qua forward-auth | ✅ Traefik `strip-identity-headers` → `/auth/verify` |
| Service auth (workspace, task, notification) | Không tin header client giả | ✅ `AuthGuard` + auth gRPC; dev-only `X-User-Id` khi `ALLOW_DEV_IDENTITY_HEADERS=true` |
| Service-to-service nội bộ | Token/mTLS giữa app | ✅ `INTERNAL_SERVICE_TOKEN` + NetworkPolicy ingress allow lists (B3–B4) |
| Secrets không trong Git | Prod secrets từ vault | ⚠️ `.env.example` + Helm placeholders; External Secrets 📋 checklist |
| Metrics lockdown | `/metrics` không public | ✅ `METRICS_AUTH_TOKEN` khi set |
| Input validation | DTO + validation pipe | ✅ NestJS `ValidationPipe` |
| Audit log / compliance | Trace mọi thao tác admin | ❌ Out of scope MVP |

---

## 5. Observability (Quan sát)

| NFR | Mục tiêu | CollabSpace |
|-----|----------|-------------|
| Metrics | Golden signals per service | ✅ Prometheus `/metrics` (5 services); Grafana dashboard |
| Alerting | Cảnh báo down / 5xx / queue depth | ✅ `alert-rules.yml` + runbooks |
| Distributed tracing | Trace request xuyên service | ⚠️ OpenTelemetry → Jaeger (`docker-compose.tracing.yml`); prod tắt mặc định |
| Centralized logging | Log tập trung | ⚠️ ELK compose có; correlation ID end-to-end chưa đồng nhất 100% |
| Replica sync lag | Phát hiện eventual consistency trễ | ✅ `user_replica_sync_lag_seconds`, `user_replica_fallback_total` |

---

## 6. Data consistency & integrity (Nhất quán dữ liệu)

| NFR | Mục tiêu | CollabSpace |
|-----|----------|-------------|
| Database per service | Ranh giới dữ liệu rõ | ✅ Postgres/Mongo tách theo service |
| Không JOIN xuyên DB | Read model / sync / event | ✅ [cross-service-data.md](./cross-service-data.md) |
| Transactional outbox | Event không mất sau commit DB | ✅ auth email, workspace invite, task events |
| Eventual consistency có fallback | Race event vs read | ✅ HTTP hydrate replica khi thiếu |
| Strong consistency khi cần | Membership, auth | ✅ HTTP/gRPC sync (workspace, auth verify) |
| Event sourcing (task) | Audit trail aggregate Task | ✅ Mongo `task_events` + projection |

---

## 7. Recoverability & backup (Phục hồi)

| NFR | Mục tiêu | CollabSpace |
|-----|----------|-------------|
| RPO/RTO documented | Biết mất bao nhiêu data / downtime | 📋 [backup-policy.md](./backup-policy.md) — RPO 24h demo |
| Backup scripts | Postgres + Mongo dump | ✅ `infrastructure/backup/scripts/` |
| Automated backup schedule | Cron prod | ❌ Chưa — checklist prod |
| Restore drill | Kiểm chứng khôi phục | 📋 Quarterly — manual |
| DLQ | Message hỏng không mất | ✅ RabbitMQ DLQ definitions |

---

## 8. Operability & deployability (Vận hành)

| NFR | Mục tiêu | CollabSpace |
|-----|----------|-------------|
| Local dev reproducible | Docker Compose one command | ✅ `infrastructure/docker/` |
| K8s deploy | Helm umbrella chart | ✅ `infrastructure/helm/collabspace/` |
| Migrations | Schema versioned | ✅ TypeORM/Flyway migrations per service |
| Seed demo | Luồng demo 7 bước | ✅ `scripts/seed.sh` + `demo-seed-data.json` |
| Runbooks | Alert → hướng xử lý | ✅ `docs/runbooks/` |
| CI quality gates | Test/lint on every PR | ⚠️ Jenkins compose có; coverage không đồng đều mọi service |

---

## 9. Maintainability & testability (Bảo trì)

| NFR | Mục tiêu | CollabSpace |
|-----|----------|-------------|
| Service boundaries rõ | Một team/feature → một service | ✅ auth, user, workspace, task, notification |
| Contract docs | API + event | ✅ `service-contracts.md`, `api-routes.md` |
| Unit tests | Logic nghiệp vụ | ✅ auth, user, task, notification (mức độ khác nhau) |
| E2E cross-service | Demo story tự động | ❌ Chưa script full 7 bước |
| Coding conventions | Layering nhất quán | ✅ `.claude/docs/coding-conventions.md`, per-service CLAUDE.md |

---

## 10. Usability & compatibility (Demo scope)

| NFR | Mục tiêu | CollabSpace |
|-----|----------|-------------|
| API versioning | `/api/v1` ổn định | ✅ |
| OpenAPI | Swagger một số service | ⚠️ user, task; chưa 5/5 |
| Frontend client | UI end-user | ❌ Backend + infra focus |
| i18n / accessibility | — | ❌ Out of scope |

---

## Tóm tắt: CollabSpace “đảm bảo” gì?

Dự án **có cơ sở thực tế** (code + infra + doc) cho các NFR sau — phù hợp **demo và học microservices**:

1. **Chịu lỗi có chủ đích** — health, timeout, 503, saga, outbox, idempotency, degradation matrix.
2. **Quan sát được** — metrics, alerts, runbooks, optional tracing/logging stack.
3. **Bảo mật demo** — JWT, gateway auth, workspace JWT verify, metrics token, internal replica token.
4. **Dữ liệu phân tán đúng cách** — DB/service, read model, không JOIN xuyên service.
5. **Triển khai lặp lại được** — Docker, Helm, migrations, seed.

**Chưa cam kết production-grade** cho: SLO latency, HA multi-region, secrets automation, backup cron, mTLS mesh, E2E CI, audit compliance — xem [production-hardening.md](./production-hardening.md) để đóng gap.

---

## Ma trận NFR → artifact (tra cứu nhanh)

| NFR | Nơi kiểm chứng |
|-----|----------------|
| Readiness | `infrastructure/resilience/drills/verify-readiness.sh` |
| Resilience policy | `.claude/docs/resilience.md` |
| Cross-service data | `docs/cross-service-data.md` |
| Alerts | `infrastructure/monitoring/alert-rules.yml` |
| Gateway resilience | `api-gateway/dynamic/middlewares.yml` |
| Backup | `docs/backup-policy.md` |
| Prod gaps | `docs/production-hardening.md` |

# CollabSpace — Design for Failure (tổng quan)

Tài liệu chi tiết (tiếng Anh, dùng cho dev/agent): [`.claude/docs/resilience.md`](../.claude/docs/resilience.md)

## Vì sao cần?

Microservices CollabSpace phụ thuộc lẫn nhau (gRPC, RabbitMQ, DB). **Design for failure** nghĩa là thiết kế sẵn cho tình huống từng phần hỏng, thay vì giả định mọi thứ luôn chạy.

## Nguyên tắc cốt lõi

1. **Timeout** mọi gọi sync giữa services (mặc định 3s).
2. **Event** có `eventId` + `occurredAt`; consumer **idempotent**.
3. Dependency down → **`503`** + `code` rõ (`*_UNAVAILABLE`), không `500` mù.
4. **Health**: `live` vs `ready`; không nhận traffic khi `ready: false`.
5. **Không fail im lặng** trên luồng quan trọng (đăng ký, xác thực, ghi dữ liệu).

## Đã có sẵn trong repo

- Outbox email (auth-service)
- DLQ RabbitMQ (`infrastructure/rabbitmq/definitions.json`)
- gRPC timeout auth ↔ user
- Traefik retry + circuit breaker
- Readiness auth/user với dependency checks

## Việc tiếp theo (roadmap)

| Phase | Nội dung |
|-------|----------|
| 0 | Tài liệu chính sách — **đang dùng** |
| 1 | Saga register, dedupe notification, health đồng nhất |
| 2 | Outbox cho event workspace/task, idempotency key HTTP |
| 3 | Metrics, tracing, failure drills, runbooks |

## Ma trận nhanh (mục tiêu)

| Khi hỏng… | Register | Login / API user | Task ghi |
|-----------|----------|------------------|----------|
| user-service | Không orphan user → `503` | User API `503` | — |
| auth-service | — | `503` | `503` nếu cần verify |
| RabbitMQ | Register vẫn OK (OTP qua outbox) | OK | Event retry/DLQ |
| Postgres/Mongo | `503` | `503` | `503` |

Chi tiết từng endpoint: xem bảng đầy đủ trong `.claude/docs/resilience.md` mục 4.

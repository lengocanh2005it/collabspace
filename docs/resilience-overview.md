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

## Đã triển khai (Phases 0–4)

| Phase | Nội dung | Trạng thái |
|-------|----------|------------|
| 0 | Tài liệu chính sách | **xong** |
| 1 | Saga register (rollback auth user khi gRPC fail), dedupe notification theo `eventId`, health live/ready cho mọi service | **xong** |
| 2 | Outbox workspace/task events, `Idempotency-Key`, workspace HTTP client | **xong** |
| 3 | Metrics `/metrics` (5 services), tracing bootstrap, runbooks, drill script `verify-readiness.sh` | **xong** |
| 4 | Chaos `chaos-stop-service.sh`, production hardening checklist, K8s/Helm probes | **xong** |

### Bổ sung gần đây

- **Register + Redis down** → `503` `REDIS_UNAVAILABLE`, rollback user mới tạo (`auth-service`).
- **Workspace / task / notification auth** → `AuthGuard` verify JWT qua auth gRPC; dev-only `ALLOW_DEV_IDENTITY_HEADERS`.
- **Gateway strip** → Traefik `strip-identity-headers` trước `forward-auth` (client không gửi được `X-User-Id` giả).
- **Task → workspace S2S** → internal membership API + `X-Internal-Service-Token` (không dùng `X-User-Id` header).
- **NetworkPolicy (K8s)** → default deny; task/notification → user internal HTTP; task → workspace internal; peers → auth gRPC.
- **Gateway internal block** → Traefik từ chối `/workspaces/internal` và `/users/internal` (503).
- **Metrics lockdown** → env `METRICS_AUTH_TOKEN` (Bearer hoặc `X-Metrics-Token`); Helm `global.secrets.metricsAuthToken`.
- **Backup policy** → `docs/backup-policy.md`, scripts `infrastructure/backup/scripts/`.
- **NFRs** → `docs/nfrs.md` (thuộc tính chất lượng hệ thống).
- **Trade-offs** → `docs/trade-offs.md` (quyết định kiến trúc và cái giá).

## Drills

```sh
# Docker stack up trước
./infrastructure/resilience/drills/verify-readiness.sh
./infrastructure/chaos/chaos-stop-service.sh auth-service
```

Chi tiết: `infrastructure/resilience/drills/README.md`.

## Ma trận nhanh (mục tiêu)

| Khi hỏng… | Register | Login / API user | Task ghi |
|-----------|----------|------------------|----------|
| user-service | Không orphan user → `503` | User API `503` | — |
| Redis (OTP) | `503` `REDIS_UNAVAILABLE` | Resend OTP `503` | — |
| auth-service | — | `503` | `503` nếu cần verify |
| RabbitMQ | Register OK (OTP qua outbox) | OK | Event retry/DLQ |
| Postgres/Mongo | `503` | `503` | `503` |

Chi tiết từng endpoint: xem bảng đầy đủ trong `.claude/docs/resilience.md` mục 4.

## Production còn lại (ngoài code app)

- Secrets từ External Secrets / vault — không plaintext trong Helm values prod.
- Network policy / ingress hạn chế `/metrics` ngay cả khi có token.
- Backup tự động + restore drill theo `docs/backup-policy.md`.

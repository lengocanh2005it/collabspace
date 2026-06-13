# CollabSpace — Thiết kế chịu lỗi (tổng quan)

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
- **Phase C — Correlation ID** → `X-Request-Id` middleware (5 services), S2S HTTP forward; structured log injection trong app chưa 100%.
- **Infra backlog** → `docs/team/phan-phu-tho-infrastructure-backlog.md` (Vault HA + ESO operational, CI/CD, backup/restore, Loki/alert routing, …). Vault scaffold: `infrastructure/vault/README.md`.
- **Observability** → `docs/observability.md` (Grafana, Prometheus, Loki, k6).
- **Deploy production DO** → `docs/deployment-k3s-phases.md` (k3s + Helm + Vault + ESO theo phase).

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

## Production còn lại (infra / vận hành)

Xem checklist đầy đủ: [production-hardening.md](./production-hardening.md) và [phan-phu-tho-infrastructure-backlog.md](./team/phan-phu-tho-infrastructure-backlog.md).

| Hạng mục | Trạng thái |
|----------|------------|
| HashiCorp Vault + ESO (staging/prod) | **Partial** — single-node Vault + ESO deploy trên Droplet prod ✅; Vault HA + rotation operational ⬜ |
| CI/CD pipeline (GitHub Actions) | **Partial** — CI + GHCR build + Helm deploy on `main` ✅; post-deploy `demo-e2e` smoke ⬜ |
| Monitoring stack trên K8s + alert routing | **Partial** — Prometheus/Grafana/Loki trên Droplet prod ✅; 5/5 app scrape UP; alert routing Slack ⬜; DB exporter scrape ⬜ |
| Backup tự động + restore drill | Policy + `backup-*.sh` có; chưa CronJob / restore script |
| Centralized logging (Loki) | **K8s prod** ✅ Promtail → Loki → Grafana Explore; Docker ELK profile tùy chọn chưa nối agent |
| Tracing prod (`TRACING_ENABLED`) | Optional compose; chưa staging default |
| Demo E2E script 7 bước | ✅ `scripts/demo-e2e.*` + `infrastructure/deploy/run-demo-e2e-prod.sh`; chưa gate CI smoke |

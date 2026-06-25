# Checklist cứng hóa production (Phase 4)

Dùng trước khi expose CollabSpace ra ngoài môi trường local/demo.

**Lộ trình triển khai:** [deployment-k3s-phases.md](./deployment-k3s-phases.md) (Phase 5).

## Kubernetes / Helm

- [x] Readiness: `/health/ready` (503 khi dependency thiếu). Liveness: `/health/live`.
- [x] `preStop` sleep + `terminationGracePeriodSeconds` (xem `infrastructure/k8s/*-deployment.yaml` và template Helm).
- [ ] Tune resource requests/limits sau load test.
- [x] PodDisruptionBudget cho tầng app stateless (`infrastructure/k8s/pdb.yaml`).
- [ ] **Secrets:** thay placeholder `stringData` — dùng **HashiCorp Vault + External Secrets Operator** (`infrastructure/vault/`) hoặc Sealed Secrets / cloud secret manager. Chỉ inject `global.secrets.*` qua CI/CD, không commit values. Bật `global.externalSecrets.enabled: true` khi ESO quản lý `{app}-secrets`.
- [x] Đường scrape Prometheus: `/api/v1/*/metrics` trên mỗi service.
- [x] **Xác thực metrics:** `global.secrets.metricsAuthToken` + Secret `prometheus-metrics-auth`; Prometheus scrape Bearer — Helm prod ✅.

## Ứng dụng (đã implement)

- [x] `Idempotency-Key` trên API ghi workspace/task.
- [x] Transactional outbox cho event xuyên service (email auth, invite workspace, assign task).
- [x] Dedupe notification theo `eventId` trên consumer.
- [x] Saga rollback register khi auth → user profile thất bại.
- [x] Register trả `503` `REDIS_UNAVAILABLE` khi Redis down (rollback user mới).
- [x] `profileStatus: unavailable` trên `/auth/me` khi user-service gRPC fail.
- [x] `WORKSPACE_CLIENT_MODE=http` trong task-service kèm timeout.
- [x] workspace-service `AuthGuard`: JWT qua auth gRPC; dev-only `X-User-Id` khi `ALLOW_DEV_IDENTITY_HEADERS=true`.
- [x] task-service + notification-service `AuthGuard`: JWT qua auth gRPC; bỏ mock `user-123` / tin `X-User-Id` thô.
- [x] Traefik `strip-identity-headers`: xóa header `X-User-*` / role từ client trước `forward-auth`.
- [x] task-service → workspace-service membership và task/notification → user replica lookup qua internal HTTP + **Service JWT** (`SERVICE_JWT_SECRET` — không còn shared static token).
- [x] K8s NetworkPolicies: default deny + ingress theo service (task→workspace/user internal, gRPC auth, Traefik HTTP public).
- [x] Gateway chặn `/api/v1/*/internal/*` từ Traefik (503).
- [x] `/metrics` yêu cầu `METRICS_AUTH_TOKEN` khi đặt (app services).
- [x] **Correlation ID (Phase C):** middleware `X-Request-Id` trên HTTP services; forward trên S2S HTTP task→workspace và task/notification→user.

## Quan sát (Observability)

- [x] Prometheus + Alertmanager + alert rules (`infrastructure/monitoring/`).
- [x] Infra exporters (Docker: `docker-compose.exporters.yml`; K8s: Helm `templates/observability/exporters.yaml`).
- [x] K8s Helm stack: Prometheus, Grafana (`/grafana`), Loki, Promtail — [docs/observability.md](./observability.md).
- [x] Grafana dashboards provisioned (`service-health`, `logs-errors` → **App Logs**, `load-test-run`).
- [x] Grafana datasource UID `prometheus` / `loki` khớp dashboard JSON.
- [x] Prometheus scrape app + Traefik; `metricsAuthToken` + SA `prometheus`.
- [ ] Sync `alert-rules.yml` vào Prometheus ConfigMap trên cluster đích (nếu chưa).
- [x] Alertmanager receiver Slack test trên Droplet 2026-06-20 (Vault -> ESO `alertmanager-slack-secret` -> Alertmanager). Email receiver chưa cấu hình riêng.
- [x] Runbook liên kết từ alert (`docs/runbooks/`).
- [ ] Drill readiness định kỳ — chạy `infrastructure/resilience/drills/verify-readiness.sh` sau deploy.
- [ ] `TRACING_ENABLED=true` chỉ khi Jaeger/OTLP collector reachable.
- [ ] k6 capacity baseline document (P3).

## Chaos / DR

- [ ] Chạy `infrastructure/chaos/chaos-stop-service.sh` trên staging hàng quý.
- [x] RPO/RTO đã document — `docs/backup-policy.md`.
- [ ] Lịch backup Postgres/Mongo tự động; restore drill ghi log hàng quý.

## Tham chiếu secret (không bao giờ commit giá trị thật)

| Secret | Consumer | Nguồn |
|--------|----------|-------|
| `JWT_SECRET` | auth (ký); peer verify qua auth gRPC | Vault `secret/collabspace/<env>` → ESO |
| `SERVICE_JWT_SECRET` | auth, user, workspace (inbound verify); task, notification (outbound sign); dlq-service/analytics prod bootstrap; task → workspace/user internal HTTP | Vault → ESO; Helm `global.secrets.serviceJwtSecret` khi tắt ESO |
| `POSTGRES_PASSWORD` | auth, user, workspace + Bitnami postgres | Managed DB hoặc secret |
| `REDIS_PASSWORD` | auth, notification | Secret manager |
| `KAFKA_BROKERS` | Kafka consumers/producers (task, notification, dlq, user outbox mode) | ConfigMap / env |
| `METRICS_AUTH_TOKEN` | Prometheus scrape, `/metrics` app | Secret manager |
| Email (Resend API) | auth outbox | Vault `resend_api_key` -> ESO |

Helm: `infrastructure/helm/collabspace/values.yaml` → `global.secrets` chỉ cho **default local/chart**. Production dùng `-f values-prod.yaml` từ pipeline an toàn hoặc `--set-file` từ CI secrets.

## Tài liệu liên quan

- Vault + ESO: `infrastructure/vault/README.md`
- **Observability (Grafana/Loki/k6):** `docs/observability.md`
- Chính sách resilience: `.claude/docs/resilience.md`
- Backup: `docs/backup-policy.md`
- Tổng quan resilience: `docs/resilience-overview.md`
- NFR: `docs/nfrs.md`
- Trade-offs: `docs/trade-offs.md`
- Backlog infra: `docs/team/phan-phu-tho-infrastructure-backlog.md`
- Correlation ID: `.claude/docs/service-contracts.md` → Correlation ID (`X-Request-Id`)
- Lộ trình deploy: `docs/deployment-k3s-phases.md`

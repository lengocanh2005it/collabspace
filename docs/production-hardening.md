# Production hardening checklist (Phase 4)

Use before exposing CollabSpace beyond local/demo environments.

## Kubernetes / Helm

- [x] Readiness: `/health/ready` (503 when dependency missing). Liveness: `/health/live`.
- [x] `preStop` sleep + `terminationGracePeriodSeconds` (see `infrastructure/k8s/*-deployment.yaml` and Helm templates).
- [ ] Resource requests/limits tuned after load test.
- [x] PodDisruptionBudgets for stateless app tiers (`infrastructure/k8s/pdb.yaml`).
- [ ] **Secrets:** replace placeholder `stringData` — use External Secrets Operator, Sealed Secrets, or cloud secret manager. Set `global.secrets.*` in Helm only via CI/CD secret injection, not committed values.
- [x] Prometheus scrape paths: `/api/v1/*/metrics` on each service.
- [ ] **Metrics auth:** set `global.secrets.metricsAuthToken` in Helm; configure Prometheus `authorization.credentials` or `bearer_token` / custom header `X-Metrics-Token`. Leave empty only in local dev.

## Application (implemented)

- [x] `Idempotency-Key` on mutating workspace/task APIs.
- [x] Transactional outbox for cross-service events (auth email, workspace invite, task assign).
- [x] Notification `eventId` dedupe on consumers.
- [x] Register saga rollback on auth → user profile failure.
- [x] Register returns `503` `REDIS_UNAVAILABLE` when Redis is down (with rollback for new users).
- [x] `profileStatus: unavailable` on `/auth/me` when user-service gRPC fails.
- [x] `WORKSPACE_CLIENT_MODE=http` in task-service with timeouts.
- [x] workspace-service `AuthGuard`: JWT via auth gRPC; dev-only `X-User-Id` fallback.
- [x] `/metrics` gated by `METRICS_AUTH_TOKEN` when set (all five services).

## Observability

- [x] Prometheus + Alertmanager + alert rules (`infrastructure/monitoring/`).
- [x] Infra exporters (Docker: `docker-compose.exporters.yml`; K8s: `exporters-deployment.yaml`).
- [ ] K8s: apply monitoring stack and sync rules via `k8s/scripts/sync-prometheus-alert-rules.ps1` in target cluster.
- [ ] Grafana datasource UID `prometheus` matches dashboard JSON in your environment.
- [x] Runbooks linked from alerts (`docs/runbooks/`).
- [ ] Periodic readiness drill — run `infrastructure/resilience/drills/verify-readiness.sh` after deploy (see `infrastructure/resilience/drills/README.md`).
- [ ] `TRACING_ENABLED=true` only when Jaeger/OTLP collector is reachable.

## Chaos / DR

- [ ] Run `infrastructure/chaos/chaos-stop-service.sh` in staging quarterly.
- [x] RPO/RTO documented — `docs/backup-policy.md`.
- [ ] Automated Postgres/Mongo backups scheduled; restore drill logged quarterly.

## Secrets reference (never commit real values)

| Secret | Consumers | Source |
|--------|-----------|--------|
| `JWT_SECRET` | auth, user, workspace, task, notification | Secret manager |
| `POSTGRES_PASSWORD` | Nest/Kotlin DB services | Managed DB or secret |
| `REDIS_PASSWORD` | auth, notification | Secret manager |
| `RABBITMQ_PASSWORD` | publishers/consumers | Secret manager |
| `METRICS_AUTH_TOKEN` | Prometheus scrape, all app `/metrics` | Secret manager |
| SMTP / email | auth outbox | Secret manager |

Helm: `infrastructure/helm/collabspace/values.yaml` → `global.secrets` is for **local/chart defaults only**. Production installs should use `-f values-prod.yaml` from a secure pipeline or `--set-file` from CI secrets.

## Related docs

- Resilience policy: `.claude/docs/resilience.md`
- Backup policy: `docs/backup-policy.md`
- Overview (VI): `docs/resilience-overview.md`
- NFRs (VI): `docs/nfrs.md`
- Trade-offs (VI): `docs/trade-offs.md`

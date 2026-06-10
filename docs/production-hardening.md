# Production hardening checklist (Phase 4)

Use before exposing CollabSpace beyond local/demo environments.

## Kubernetes

- [ ] Readiness: `/health/ready` (503 when dependency missing). Liveness: `/health/live`.
- [ ] `preStop` sleep + `terminationGracePeriodSeconds` (see `infrastructure/k8s/*-deployment.yaml`).
- [ ] Resource requests/limits set per service; tune after load test.
- [ ] PodDisruptionBudgets for stateless app tiers (`infrastructure/k8s/pdb.yaml`).
- [ ] Secrets from external store — replace placeholder `stringData` in deployment secrets.
- [ ] Prometheus scrape paths match service metrics (`/api/v1/*/metrics`).

## Application

- [ ] `Idempotency-Key` on mutating workspace/task APIs.
- [ ] Transactional outbox for cross-service events (auth, workspace, task).
- [ ] Notification `eventId` dedupe on all consumers.
- [ ] Register saga rollback on auth → user profile failure.
- [ ] `profileStatus: unavailable` on `/auth/me` when user-service gRPC fails.
- [ ] `WORKSPACE_CLIENT_MODE=http` in task-service with timeouts.

## Observability

- [ ] Prometheus + Alertmanager + alert rules (`infrastructure/monitoring/`).
- [ ] Infra exporters running (Docker: `docker-compose.exporters.yml`; K8s: `exporters-deployment.yaml`).
- [ ] K8s: apply `prometheus-deployment.yaml` and sync rules via `k8s/scripts/sync-prometheus-alert-rules.ps1`.
- [ ] Grafana datasource UID `prometheus` matches dashboard JSON.
- [ ] Runbooks linked from alerts (`docs/runbooks/`).
- [ ] Periodic readiness drill (`infrastructure/resilience/drills/`).
- [ ] `TRACING_ENABLED=true` only when Jaeger/OTLP collector is reachable.

## Chaos / DR

- [ ] Run `infrastructure/chaos/chaos-stop-service.sh` in staging quarterly.
- [ ] Document RPO/RTO for Postgres and Mongo backups.

## Known gaps

- workspace-service trusts gateway `X-User-Id` — verify JWT via auth gRPC in production.
- `/metrics` endpoints are unauthenticated — restrict with network policy in production.

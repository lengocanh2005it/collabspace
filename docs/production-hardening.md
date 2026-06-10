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

- [ ] Prometheus + alert rules (`infrastructure/monitoring/`).
- [ ] Runbooks linked from alerts (`docs/runbooks/`).
- [ ] Periodic readiness drill (`infrastructure/resilience/drills/`).

## Chaos / DR

- [ ] Run `infrastructure/chaos/chaos-stop-service.sh` in staging quarterly.
- [ ] Document RPO/RTO for Postgres and Mongo backups.

## Known gaps

- workspace-service trusts gateway `X-User-Id` — verify JWT via auth gRPC in production.
- Full OTEL auto-instrumentation not yet bundled; tracing is env-gated bootstrap only.

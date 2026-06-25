# CollabSpace Resilience & Design for Failure

**Status:** Phases 0–4 implemented (policy + health, outbox, metrics, runbooks, chaos drills).  
**Audience:** developers, agents, reviewers.  
**Related:** `service-contracts.md`, `project-architecture.md`, `development-workflows.md`.

## Tóm tắt (Vietnamese)

Tài liệu này quy định cách CollabSpace **chịu lỗi**: timeout bắt buộc cho gRPC/HTTP nội bộ, retry/circuit breaker cho sync HTTP dependency, contract lỗi `503` khi dependency down, event phải có `eventId` + consumer idempotent, và ma trận “dependency X down → API Y trả gì”. Khi code và doc lệch nhau, ưu tiên sửa code rồi cập nhật doc.

---

## 1. Goals

CollabSpace assumes failures are normal:

- PostgreSQL, MongoDB, Redis, or Kafka slow or unavailable
- gRPC peers timeout or restart
- Duplicate message delivery on the event bus
- Partial outages during deploys or local Docker startup order

Design goals:

1. **Detect** problems early (`/health/live`, `/health/ready`, metrics, alerts).
2. **Contain** failures (timeouts, circuit breaking at the edge, bulkheads where practical).
3. **Recover** safely (retries with limits, outbox, idempotent handlers, DLQ).
4. **Degrade** predictably (documented behavior — no silent wrong answers).

---

## 2. Principles (mandatory for new code)

### 2.1 Synchronous cross-service calls

| Rule | Requirement |
|------|-------------|
| Timeout | Every gRPC/HTTP client call MUST have an explicit timeout. Default: **3000ms** unless documented otherwise. |
| Env vars | `AUTH_SERVICE_GRPC_TIMEOUT_MS`, `USER_SERVICE_GRPC_TIMEOUT_MS` — align across services. |
| No hang | Never block a request thread indefinitely waiting on a peer. |
| Error mapping | Peer down/timeout → `503 Service Unavailable` with stable `code` ending in `_UNAVAILABLE` or `_TIMEOUT`. |
| Retries | Only **idempotent** reads or explicitly idempotent writes; max **3** attempts with backoff; no retry on `4xx` (except `429`). |
| Circuit breaker | Sync HTTP clients MUST fail fast after repeated transient failures and probe again after reset timeout. |

**Existing implementations:**

- `services/auth-service/src/integrations/user-profiles/user-profiles-grpc.service.ts`
- `services/user-service/src/integrations/auth/auth-grpc.service.ts`
- `services/task-service/src/infrastructure/clients/workspace-http.client.ts`
- `services/task-service/src/infrastructure/clients/user-profile-http.client.ts`
- `services/notification-service/src/infrastructure/clients/user-profile-http.client.ts`

### 2.2 Asynchronous events (Kafka)

| Rule | Requirement |
|------|-------------|
| Payload | Every event MUST include `eventId` (UUID) and `occurredAt` (ISO 8601 UTC). |
| Publish timing | Publish **after** local persistence succeeds (prefer transactional outbox). |
| Delivery | Assume **at-least-once** delivery. |
| Consumer | Handlers MUST be **idempotent** (dedupe on `eventId` before side effects). |
| Consumer startup | Consumers MUST retry transient broker/topic metadata errors during startup and MUST NOT crash the HTTP service after bounded startup retries fail. |
| Failure | After max retries → **DLQ topic** `collabspace.dlq.events` (see `docs/runbooks/KafkaDlqNotEmpty.md`). |
| Unknown fields | Consumers MUST ignore unknown JSON fields. |

Canonical routing keys / queues: see `service-contracts.md` → Event Contracts.

### 2.3 HTTP error contract

All NestJS services SHOULD return errors shaped as:

```json
{
  "code": "STABLE_MACHINE_CODE",
  "message": "Human-readable explanation"
}
```

| HTTP | When |
|------|------|
| `400` | Validation, bad input (`*_INVALID`) |
| `401` | Missing/invalid token (`TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`) |
| `403` | Authenticated but not allowed |
| `404` | Resource not found (`USER_NOT_FOUND`, …) |
| `409` | Conflict (`USER_ALREADY_EXISTS`, …) |
| `503` | Required dependency unavailable (`*_UNAVAILABLE`, `*_TIMEOUT`) |
| `500` | Unexpected bug only — not for known dependency outages |

Do **not** map dependency failures to generic `500` if the cause is known.

### 2.4 Silent failure policy

| Pattern | Policy |
|---------|--------|
| **Critical path** (register, login, token verify, payment-like writes) | MUST fail loudly with correct HTTP status + `code`. |
| **Enrichment** (profile fields on `/me`, display names) | MAY degrade (omit optional fields) ONLY if documented in the degradation matrix below. |
| **Side effects** (events, notifications) | MUST log + metric; MUST NOT fail the primary HTTP response unless the business requires it. |

**DONE:** `auth-service` returns `profileStatus: "unavailable"` on `/auth/me` when user-service gRPC fails; optional `fullName`/`username` omitted.

### 2.5 Health endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET .../health/live` | Process up; no dependency checks. Always `200` if process running. |
| `GET .../health/ready` | Dependency checks; `503` when not ready for traffic. |
| `GET .../health` | Alias or summary — follow per-service implementation. |

**Readiness semantics:**

- `ready: false` → load balancers / Traefik MUST NOT send user traffic.
- `mode: "degraded"` → optional dependencies unhealthy; required deps still up (auth outbox uses this pattern).
- Required vs optional checks MUST be explicit in each `*-health.service.ts`.

**Implemented:** auth-service, user-service, workspace-service, task-service, notification-service, dlq-service, analytics-service (`/health/live`, `/health/ready` with dependency checks).

---

## 3. Infrastructure resilience (existing)

| Component | Location | Behavior |
|-----------|----------|----------|
| Traefik retry | `api-gateway/dynamic/middlewares.yml` → `retry-policy` | 3 attempts, 100ms initial interval |
| Traefik circuit breaker | `circuit-breaker` | `NetworkErrorRatio() > 0.3` |
| Forward auth | `strip-identity-headers` → `forward-auth` → `/api/v1/auth/verify` | Gateway strips spoofed identity headers, then validates JWT |
| Kafka DLQ | `collabspace.dlq.events` + `@collabspace/shared` consumer retry | Failed consumer messages |
| Kafka consumer startup | `@collabspace/shared` `startKafkaConsumerWithRetry` | Retries broker/topic metadata races during deploy without crashing app pods |
| Sync HTTP retry + circuit breaker | `@collabspace/shared` `retryAsync`, `CircuitBreaker` | task → workspace/user and notification → user fallback clients retry 5xx/network, then fail fast when peer remains unhealthy |
| Service rate limit | `@collabspace/shared` `createServiceRateLimitMiddleware` | 5 core HTTP services default to 100 req/min/IP; skips health, metrics, Swagger |
| Auth email outbox | `services/auth-service/src/infrastructure/outbox/*` | DB-backed queue, retries, degraded thresholds |
| K8s PDB | `infrastructure/k8s/pdb.yaml` | minAvailable per service |
| Prometheus alerts | `infrastructure/monitoring/alert-rules.yml` + Alertmanager | ServiceDown, 5xx rate, … |
| Infra exporters | `docker-compose.exporters.yml`, `k8s/exporters-deployment.yaml` | Postgres/Redis/Mongo/Kafka metrics |

**DONE:** App services expose Prometheus `/metrics` (see each service health or root controller). Optional lockdown via `METRICS_AUTH_TOKEN` (Bearer or `X-Metrics-Token`). Alert rules in `infrastructure/monitoring/alert-rules.yml` fire when scrape targets are up.

---

## 4. Degradation matrix (target behavior)

Legend: **Current** = observed or likely today; **Target** = required after resilience phases.

### 4.1 auth-service

| API / flow | Dependency down | Current | Target |
|------------|-----------------|---------|--------|
| `POST /auth/register` | user-service gRPC | Compensating saga rolls back new auth user on gRPC failure | `503` + rollback **(DONE — Phase 1)** |
| `POST /auth/register` | Redis | OTP storage fails | `503` `REDIS_UNAVAILABLE` + rollback if newly created **(DONE)** |
| `POST /auth/register` | Postgres | — | `503` |
| `POST /auth/login` | Postgres / Redis | Fail | `503` / `401` as appropriate |
| `GET /auth/me` | user-service gRPC | Returns identity with `profileStatus: "unavailable"`; omits `fullName`/`username` | Degrade OK **(DONE)** |
| `GET /auth/health/ready` | user-service gRPC | `503` not ready | Keep required |
| Email OTP send | outbox / Resend API | Outbox retries; readiness `degraded` if backlog | Keep; alert on failed outbox |

### 4.2 user-service

| API / flow | Dependency down | Current | Target |
|------------|-----------------|---------|--------|
| Protected HTTP routes | auth gRPC | `503` `AUTH_SERVICE_GRPC_UNAVAILABLE` | Keep |
| `GET /users/health/ready` | auth gRPC | `503` | Keep |
| `CreatePendingProfile` (gRPC) | Postgres | gRPC error to caller | Fail to auth register saga |
| `publishUserRegistered` (outbox) | Kafka CDC lag | Log warn; HTTP/gRPC still succeeds | Keep (side effect) |

### 4.3 workspace-service

| API / flow | Dependency down | Current | Target |
|------------|-----------------|---------|--------|
| Protected routes | auth | JWT via `AuthGuard` + auth gRPC; dev-only `ALLOW_DEV_IDENTITY_HEADERS` | Keep **(DONE — Phase B1)** |
| Internal membership API | task-service | Service JWT; not on Traefik | Keep **(DONE — Phase B3–B4, B3.1)** |
| `POST .../invite` | Kafka CDC | Transactional outbox; HTTP succeeds if DB write succeeds | Keep **(DONE)** |
| `GET .../health/ready` | Postgres | `ready` checks DB ping | Keep **(DONE — Phase 1)** |

### 4.4 task-service

| API / flow | Dependency down | Current | Target |
|------------|-----------------|---------|--------|
| Protected routes | auth gRPC | `AuthGuard` on task/comment controllers | Keep **(DONE — Phase B1)** |
| Task mutations | workspace membership | Internal HTTP + Service JWT with timeout, retry, circuit breaker, Redis cache | Keep **(DONE — Phase B3, B3.1 + resilience sync)** |
| Workspace member removed/left | workspace `member_left` Kafka event | Clears task-service membership cache entry for `(workspaceId,userId)` | Keep **(DONE)** |
| `TASK_ASSIGNED` publish | Kafka CDC | Mongo outbox + Debezium | Keep **(DONE)** |
| Reads | MongoDB | Fail | `503` |

### 4.5 notification-service

| API / flow | Dependency down | Current | Target |
|------------|-----------------|---------|--------|
| Event consumers | MongoDB | nack / error path | Retry → DLQ |
| Event consumers | duplicate `eventId` | `processed_events` collection dedupes by `eventId` | Keep **(DONE — Phase 1)** |
| Protected `GET/PATCH /notifications` | auth gRPC | `AuthGuard`; not raw `X-User-Id` | Keep **(DONE — Phase B1)** |
| `GET /notifications` | MongoDB | — | `503`; empty list only when truly empty |
| Kafka consumer | broker down | `ready: false` when broker unreachable | Keep **(DONE)** |

### 4.6 analytics-service

| API / flow | Dependency down | Current | Target |
|------------|-----------------|---------|--------|
| Protected analytics routes | auth gRPC | `PlatformAdminGuard` requires `analytics.read` | Keep |
| Reads | MongoDB | repository queries fail | `503`; empty snapshot only when DB is reachable and no data exists |
| Kafka consumers | broker down | `ready: false` when consumers enabled and broker unreachable | Keep |
| Duplicate analytics events | Kafka duplicate delivery | `processed_analytics_events` dedupes before `$inc` | Keep |

### 4.7 API gateway (Traefik)

| Scenario | Target |
|----------|--------|
| Client sends spoofed `X-User-Id` | Stripped at gateway; services verify JWT via gRPC **(DONE — B2/B1)** |
| Client hits `/api/v1/*/internal/*` via gateway | 503 reject service **(DONE — B4)** |
| auth-service down | Protected routes fail auth; public auth routes fail with `502/503` |
| Single app instance not ready | Health check removes from pool |
| Downstream slow | Retry then circuit open; fail fast |

---

## 5. Idempotency & duplicate handling

| Operation | Key | Store | TTL |
|-----------|-----|-------|-----|
| Event consumption | `eventId` | notification (and all consumers) | permanent dedupe record |
| `POST /auth/verify-email` | userId + otp window | Redis | already constrained by OTP TTL |
| `POST /auth/register` | email | DB unique constraint + pending recovery | — |
| HTTP mutating APIs | `Idempotency-Key` header | Postgres (workspace) / Mongo (task) | 24h **(DONE — Phase 2)** |

---

## 6. Timeouts & env reference

| Variable | Service | Default | Purpose |
|----------|---------|---------|---------|
| `GRPC_ENABLED` | auth, user | `true` | Disable only in isolated tests |
| `GRPC_URL` | per service | see `.env.example` | Bind address |
| `USER_SERVICE_GRPC_URL` | auth | `user-service:50052` | Profile client |
| `USER_SERVICE_GRPC_TIMEOUT_MS` | auth | `3000` | Profile gRPC |
| `AUTH_SERVICE_GRPC_URL` | user | `auth-service:50051` | Token verify |
| `AUTH_SERVICE_GRPC_TIMEOUT_MS` | user | `3000` | Token verify |
| `WORKSPACE_SERVICE_TIMEOUT_MS` | task | `3000` (Helm prod: `10000`) | Workspace membership HTTP timeout per attempt |
| `WORKSPACE_SERVICE_RETRY_ATTEMPTS` | task | `2` | Retry attempts for transient workspace HTTP 5xx/network errors |
| `WORKSPACE_SERVICE_RETRY_DELAY_MS` | task | `75` | Linear retry delay base for workspace HTTP |
| `WORKSPACE_SERVICE_CIRCUIT_BREAKER_FAILURE_THRESHOLD` | task | `5` | Consecutive transient failures before fail-fast |
| `WORKSPACE_SERVICE_CIRCUIT_BREAKER_RESET_TIMEOUT_MS` | task | `30000` | Open-circuit wait before half-open probe |
| `USER_SERVICE_TIMEOUT_MS` | task, notification | `3000` | User replica lookup HTTP timeout per attempt |
| `USER_SERVICE_RETRY_ATTEMPTS` | task, notification | `3` | Retry attempts for transient user HTTP 5xx/network errors |
| `USER_SERVICE_RETRY_DELAY_MS` | task, notification | `50` | Linear retry delay base for user HTTP |
| `USER_SERVICE_CIRCUIT_BREAKER_FAILURE_THRESHOLD` | task, notification | `5` | Consecutive transient failures before fail-fast |
| `USER_SERVICE_CIRCUIT_BREAKER_RESET_TIMEOUT_MS` | task, notification | `30000` | Open-circuit wait before half-open probe |
| `SERVICE_RATE_LIMIT_ENABLED` | auth, user, workspace, task, notification | `true` | Set `false` to disable in-process fixed-window rate limit |
| `SERVICE_RATE_LIMIT_PER_MINUTE` | auth, user, workspace, task, notification | `100` | Requests per minute per IP/method per pod |
| `SERVICE_RATE_LIMIT_TTL_MS` | auth, user, workspace, task, notification | `60000` | Rate limit window size |
| `KAFKA_CONSUMERS_ENABLED` | task, notification, analytics | `false` | Enable Kafka consumers |
| `KAFKA_TOPIC_WORKSPACE_MEMBER_LEFT` | task, analytics | `collabspace.workspace.member_left` | Workspace membership removal/leave events |
| `OUTBOX_*` | auth | see `env.config.ts` | Email outbox tuning |
| `METRICS_AUTH_TOKEN` | all app services | empty (open) | When set, `/metrics` requires Bearer or `X-Metrics-Token` |

---

## 7. Observability expectations

When changing resilience behavior, update:

- Health check implementation and Traefik `healthCheck.path` in `api-gateway/dynamic/routers.yml`
- K8s probes in `infrastructure/k8s/*-deployment.yaml`
- `alert-rules.yml` if new failure modes need alerts
- This file and `service-contracts.md` if error codes or degradation rules change

**Runbooks:** each alert → `docs/runbooks/<alert>.md` (see `docs/runbooks/README.md`).

---

## 8. Implementation roadmap (after Phase 0)

| Phase | Focus |
|-------|--------|
| **0** | This document + cross-links in agent docs ✅ |
| **1** | Register saga, notification `eventId` dedupe, uniform health/ready, compose healthchecks ✅ |
| **2** | Transactional outbox for workspace/task events, idempotency keys, workspace client in task-service ✅ |
| **3** | Metrics (`prom-client` + `/metrics`), tracing bootstrap, failure drill scripts, runbooks ✅ |
| **4** | Chaos tooling (`infrastructure/chaos/`), production hardening checklist, K8s probe paths ✅ |

---

## 9. Agent / reviewer checklist

Before merging resilience-related changes:

- [ ] Cross-service calls have timeouts and mapped `503` codes
- [ ] New events include `eventId` + `occurredAt`
- [ ] Consumers dedupe or are documented as non-idempotent with justification
- [ ] Degradation matrix row updated if user-visible behavior changes
- [ ] `/health/ready` reflects new dependencies
- [ ] No new silent `catch {}` on critical paths without matrix entry
- [ ] `service-contracts.md` updated if HTTP/event contract changes

---

## 10. Maintenance

- Update this file when degradation policy, error codes, or infrastructure failure handling changes.
- Mark `GAP` items as `DONE` with PR link when implemented.
- Phase 1+ PRs that fix a GAP should update sections 4 and 8 in the same change.

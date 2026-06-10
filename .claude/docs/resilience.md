# CollabSpace Resilience & Design for Failure

**Status:** Phases 0–4 implemented (policy + health, outbox, metrics, runbooks, chaos drills).  
**Audience:** developers, agents, reviewers.  
**Related:** `service-contracts.md`, `project-architecture.md`, `development-workflows.md`.

## Tóm tắt (Vietnamese)

Tài liệu này quy định cách CollabSpace **chịu lỗi**: timeout bắt buộc cho gRPC/HTTP nội bộ, contract lỗi `503` khi dependency down, event phải có `eventId` + consumer idempotent, và ma trận “dependency X down → API Y trả gì”. Một số hành vi **hiện tại** (code) chưa đạt **mục tiêu** — được đánh dấu `GAP` để Phase 1+ xử lý. Khi code và doc lệch nhau, ưu tiên sửa code rồi cập nhật doc.

---

## 1. Goals

CollabSpace assumes failures are normal:

- PostgreSQL, MongoDB, Redis, or RabbitMQ slow or unavailable
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

**Existing implementations:**

- `services/auth-service/src/modules/identity/user-profiles-grpc.service.ts`
- `services/user-service/src/integrations/auth/auth-grpc.service.ts`

### 2.2 Asynchronous events (RabbitMQ)

| Rule | Requirement |
|------|-------------|
| Payload | Every event MUST include `eventId` (UUID) and `occurredAt` (ISO 8601 UTC). |
| Publish timing | Publish **after** local persistence succeeds (prefer transactional outbox). |
| Delivery | Assume **at-least-once** delivery. |
| Consumer | Handlers MUST be **idempotent** (dedupe on `eventId` before side effects). |
| Failure | After max retries → **DLQ** (`infrastructure/rabbitmq/definitions.json`). |
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

**Implemented:** auth-service, user-service, workspace-service, task-service, notification-service (`/health/live`, `/health/ready` with dependency checks).

---

## 3. Infrastructure resilience (existing)

| Component | Location | Behavior |
|-----------|----------|----------|
| Traefik retry | `api-gateway/dynamic/middlewares.yml` → `retry-policy` | 3 attempts, 100ms initial interval |
| Traefik circuit breaker | `circuit-breaker` | `NetworkErrorRatio() > 0.3` |
| Forward auth | `forward-auth` → `/api/v1/auth/verify` | Gateway validates JWT before protected routes |
| RabbitMQ DLQ | `infrastructure/rabbitmq/definitions.json` | `collabspace_dlx`, per-queue `*.dlq` |
| Auth email outbox | `services/auth-service/src/modules/outbox/*` | DB-backed queue, retries, degraded thresholds |
| K8s PDB | `infrastructure/k8s/pdb.yaml` | minAvailable per service |
| Prometheus alerts | `infrastructure/monitoring/alert-rules.yml` | ServiceDown, 5xx rate, … |

**GAP:** Application `/metrics` not consistently exposed; alert rules may not fire until Phase 3.

---

## 4. Degradation matrix (target behavior)

Legend: **Current** = observed or likely today; **Target** = required after resilience phases.

### 4.1 auth-service

| API / flow | Dependency down | Current | Target |
|------------|-----------------|---------|--------|
| `POST /auth/register` | user-service gRPC | Compensating saga rolls back new auth user on gRPC failure | `503` + rollback **(DONE — Phase 1)** |
| `POST /auth/register` | Redis | OTP storage fails | `503` `REDIS_UNAVAILABLE` |
| `POST /auth/register` | Postgres | — | `503` |
| `POST /auth/login` | Postgres / Redis | Fail | `503` / `401` as appropriate |
| `GET /auth/me` | user-service gRPC | Returns identity with `profileStatus: "unavailable"`; omits `fullName`/`username` | Degrade OK **(DONE)** |
| `GET /auth/health/ready` | user-service gRPC | `503` not ready | Keep required |
| Email OTP send | outbox / SMTP | Outbox retries; readiness `degraded` if backlog | Keep; alert on failed outbox |

### 4.2 user-service

| API / flow | Dependency down | Current | Target |
|------------|-----------------|---------|--------|
| Protected HTTP routes | auth gRPC | `503` `AUTH_SERVICE_GRPC_UNAVAILABLE` | Keep |
| `GET /users/health/ready` | auth gRPC | `503` | Keep |
| `CreatePendingProfile` (gRPC) | Postgres | gRPC error to caller | Fail to auth register saga |
| `publishUserRegistered` (RMQ) | RabbitMQ | Log warn; HTTP/gRPC still succeeds | Keep (side effect) |

### 4.3 workspace-service

| API / flow | Dependency down | Current | Target |
|------------|-----------------|---------|--------|
| Protected routes | auth (header only) | Trusts `X-User-Id` from gateway | Verify via auth gRPC on direct access **(GAP)** |
| `POST .../invite` | RabbitMQ | Transactional outbox; HTTP succeeds if DB write succeeds | Keep **(DONE — Phase 2)** |
| `GET .../health/ready` | Postgres | `ready` checks DB ping | Keep **(DONE — Phase 1)** |

### 4.4 task-service

| API / flow | Dependency down | Current | Target |
|------------|-----------------|---------|--------|
| Task mutations | workspace membership | HTTP client when `WORKSPACE_CLIENT_MODE=http`, else mock | Keep **(DONE — Phase 2)** |
| `TASK_ASSIGNED` publish | RabbitMQ | Mongo outbox + processor retries | Keep **(DONE — Phase 2)** |
| Reads | MongoDB | Fail | `503` |

### 4.5 notification-service

| API / flow | Dependency down | Current | Target |
|------------|-----------------|---------|--------|
| Event consumers | MongoDB | nack / error path | Retry → DLQ |
| Event consumers | duplicate `eventId` | `processed_events` collection dedupes by `eventId` | Keep **(DONE — Phase 1)** |
| `GET /notifications` | MongoDB | — | `503`; empty list only when truly empty |
| RabbitMQ consumer | broker down | `ready: false` when broker unreachable | Keep **(DONE — Phase 1)** |

### 4.6 API gateway (Traefik)

| Scenario | Target |
|----------|--------|
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
| `RABBITMQ_ENABLED` | auth, user, … | varies | Consumer/publisher |
| `OUTBOX_*` | auth | see `env.config.ts` | Email outbox tuning |

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

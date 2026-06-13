# Performance Improvement Phases

Lộ trình cải thiện latency/performance CollabSpace. Chi tiết pattern: [design-patterns.md](./design-patterns.md).

## Phase 0 — Baseline (pending)

Đo p50/p95 cho hot endpoints; k6 smoke; Grafana HTTP duration.

## Phase 1 — Quick wins ✅

| Item | Status |
|------|--------|
| Dedup workspace membership HTTP (`getMembershipAsync`) | Done (`887cfc6`) |
| Fix notification list `total` | Done |
| Cached lazy `jose` import | Done |

## Phase 2 — Auth hot path ✅

| Item | Status |
|------|--------|
| gRPC `VerifyAccessTokenLite` | Done |
| `getAuthUserLiteById` (no RBAC join) | Done |
| Roles from JWT claims on lite path | Done |
| Redis verify cache | Done (`AUTH_VERIFY_LITE_CACHE_*`) |
| Downstream guards → Lite | Done (user, workspace, task, notification) |
| Full verify giữ cho `/auth/verify` gateway | Done |

Env (auth-service):

- `AUTH_VERIFY_LITE_CACHE_ENABLED` — default `true`
- `AUTH_VERIFY_LITE_CACHE_MAX_TTL_SECONDS` — default `300`

## Phase 3 — Task read path ✅

| Item | Status |
|------|--------|
| Mongo indexes `{ workspaceId, status }`, `{ workspaceId, projectId, updatedAt }` | Done |
| Push list/board filters to Mongo (no in-memory scan of 1000 tasks) | Done |
| Task list pagination (`skip`/`limit`, default 50, max 200) | Done |
| Comment list `total` via `countByTaskIdAsync` | Done |

## Phase 4 — Task write / event sourcing (planned)

Bỏ double event replay; batch outbox mentions.

## Phase 5 — Activity read model (planned)

DB pagination / `task_activity` projection.

## Phase 6 — Async pipeline (planned)

Task outbox batch claim; RMQ DLQ.

## Phase 7 — Cache & scale (ongoing)

Membership cache; k6 SLO baseline.

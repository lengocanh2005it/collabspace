# Performance Improvement Phases

Lộ trình cải thiện latency/performance CollabSpace. Chi tiết pattern: [design-patterns.md](./design-patterns.md).

## Phase 0 — Baseline (partial)

Đo p50/p95 cho hot endpoints; k6 smoke; Grafana HTTP duration.

| Item | Status |
|------|--------|
| k6 `slo-baseline` hot-path scenario | Done (Phase 7) |
| Grafana dashboard review / prod cadence | Pending |

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

## Phase 4 — Task write / event sourcing ✅

| Item | Status |
|------|--------|
| Incremental projection sync (no full stream replay on save) | Done |
| Batch `enqueueCommentMentioned` via `insertMany` | Done |

## Phase 5 — Activity read model ✅

| Item | Status |
|------|--------|
| `task_activity` Mongo projection collection | Done |
| Write projection on task events + new comments | Done |
| Activity list reads from projection with DB `offset`/`limit` + `count` | Done |
| Seed backfill for demo data | Done |

## Phase 6 — Async pipeline ✅

| Item | Status |
|------|--------|
| Task outbox batch claim (`find` + `bulkWrite`, `TASK_OUTBOX_BATCH_SIZE`) | Done |
| Notification RMQ consumer retry → DLQ (`RABBITMQ_MAX_RETRIES`, `collabspace_dlx`) | Done |

## Phase 7 — Cache & scale ✅

| Item | Status |
|------|--------|
| Workspace membership TTL cache in task-service (`WORKSPACE_MEMBERSHIP_CACHE_*`) | Done |
| k6 `slo-baseline` scenario with per-route p95 thresholds | Done |
| Helper scripts `scripts/k6-slo-baseline.sh` / `.ps1` | Done |

Env (task-service):

- `WORKSPACE_MEMBERSHIP_CACHE_ENABLED` — default `true`
- `WORKSPACE_MEMBERSHIP_CACHE_TTL_SECONDS` — default `60`
- `WORKSPACE_MEMBERSHIP_CACHE_MAX_ENTRIES` — default `2000`

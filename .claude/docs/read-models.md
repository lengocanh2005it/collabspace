# Read models & local replicas

CollabSpace avoids cross-service SQL joins. When service **A** needs user directory data frequently, it keeps a **local read model** (`user_replicas`) synced from **user-service** via RabbitMQ events.

## Pattern (mandatory for new cross-service reads)

1. **Source of truth:** `user-service` PostgreSQL profiles.
2. **Change events:** `user_registered`, `user_profile_updated` (include `occurredAt`).
3. **Consumers:** `task-service`, `notification-service` → upsert Mongo `user_replicas`.
4. **Reads:** Handlers use `UserReplicaLookupService` (local first).
5. **Fallback:** If replica missing and `USER_REPLICA_FALLBACK_ENABLED=true`, call `POST /api/v1/users/internal/replicas` on user-service (Service JWT `user.replicas.read`), upsert, retry read.
6. **Metrics:** `user_replica_sync_lag_seconds`, `user_replica_fallback_total`.

## When NOT to use replicas

| Case | Use instead |
|------|-------------|
| Workspace membership / authorization | Sync HTTP to `workspace-service` internal API + Service JWT (must be fresh; not `X-User-Id` S2S) |
| Auth `/me` profile enrichment | gRPC to user-service |
| One-shot notification payload | Denormalize in event at publish time (metadata); list API still enriches from replica |

## Collections

| Service | Collection | Purpose |
|---------|------------|---------|
| task-service | `user_replicas` | create/assign task, comments, `@mention` |
| notification-service | `user_replicas` | enrich `GET /notifications` actor |

## Env (consumers)

```env
USER_SERVICE_URL=http://user-service:3000
USER_SERVICE_TIMEOUT_MS=3000
USER_REPLICA_FALLBACK_ENABLED=true
SERVICE_JWT_SECRET=collabspace-dev-service-jwt-secret-change-me  # outbound S2S; same on user/workspace for verify
```

## Env (user-service)

```env
SERVICE_JWT_SECRET=collabspace-dev-service-jwt-secret-change-me
```

## Env (workspace-service — membership, not replica)

```env
SERVICE_JWT_SECRET=collabspace-dev-service-jwt-secret-change-me
```

Task-service sends Service JWT on `WorkspaceHttpClient` and `UserProfileHttpClient`. Gateway blocks public access to `/workspaces/internal/*`.

See also: `.claude/docs/service-contracts.md` → User replica events. **Overview (VI):** [docs/cross-service-data.md](../../docs/cross-service-data.md). **Trade-offs:** [docs/trade-offs.md](../../docs/trade-offs.md).

# Read models & local replicas

CollabSpace avoids cross-service SQL joins. When service **A** needs user directory data frequently, it keeps a **local read model** (`user_replicas`) synced from **user-service** via RabbitMQ events.

## Pattern (mandatory for new cross-service reads)

1. **Source of truth:** `user-service` PostgreSQL profiles.
2. **Change events:** `user_registered`, `user_profile_updated` (include `occurredAt`).
3. **Consumers:** `task-service`, `notification-service` → upsert Mongo `user_replicas`.
4. **Reads:** Handlers use `UserReplicaLookupService` (local first).
5. **Fallback:** If replica missing and `USER_REPLICA_FALLBACK_ENABLED=true`, call `POST /api/v1/users/internal/replicas` on user-service (header `X-Internal-Service-Token`), upsert, retry read.
6. **Metrics:** `user_replica_sync_lag_seconds`, `user_replica_fallback_total`.

## When NOT to use replicas

| Case | Use instead |
|------|-------------|
| Workspace membership / authorization | Sync HTTP to `workspace-service` (must be fresh) |
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
INTERNAL_SERVICE_TOKEN=           # required in production
```

## Env (user-service)

```env
INTERNAL_SERVICE_TOKEN=           # validates internal replica lookup
```

See also: `.claude/docs/service-contracts.md` → User replica events.

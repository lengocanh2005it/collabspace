# CollabSpace Project Architecture

## Product Summary

CollabSpace is a collaboration platform demo built around a microservices architecture. The product direction is a compact mix of workspace management, project boards, tasks, comments, mentions, identity, and notifications.

**Features and current status:** [docs/features.md](../../docs/features.md). **Demo acceptance:** [docs/mvp-demo-scope.md](../../docs/mvp-demo-scope.md).

## High-Level Runtime Topology

```text
Client
  |
  v
Traefik API Gateway
  |
  +--> auth-service          NestJS, PostgreSQL, Redis, Graphile Worker
  +--> user-service          NestJS, PostgreSQL
  +--> workspace-service     NestJS, PostgreSQL, port 8080
  +--> task-service          NestJS + CQRS, MongoDB
  +--> notification-service  NestJS + CQRS, MongoDB, Kafka consumer
  +--> dlq-service           NestJS, MongoDB, Kafka DLQ consumer/replay API
  +--> analytics-service     NestJS, MongoDB, Kafka read-model consumer API

Kafka + Debezium Connect sit beside services as the async event bus (transactional outbox → CDC → topics).
Observability: **K8s/Helm** — Prometheus, Grafana (`/grafana`), Loki + Promtail, k6 scenarios; **Docker** — optional profiles (monitoring, ELK, Jaeger). Guide: [docs/observability.md](../../docs/observability.md).
```

## Service Inventory

### auth-service

Path: `services/auth-service`

Technology:

- NestJS 11
- TypeScript
- TypeORM
- PostgreSQL
- Redis through `ioredis`
- `jose` for JWT signing/verification
- gRPC via `@nestjs/microservices`
- Graphile Worker and outbox-style email OTP dispatch

Responsibilities:

- Register users.
- Recover pending unverified registrations.
- Send/resend email verification OTP.
- Verify email OTP.
- Login with email/password.
- Issue access token and refresh token.
- Rotate refresh token.
- Logout/revoke refresh token.
- Change password and revoke sessions.
- Verify bearer token for downstream services.
- Hydrate identity with profile data from `user-service` through gRPC.

Important source paths:

- `src/app.module.ts`: module composition.
- `src/presentation/http/auth.controller.ts`: HTTP auth endpoints.
- `src/presentation/grpc/auth.grpc.controller.ts`: gRPC `VerifyAccessToken`.
- `src/application/use-cases/*`: auth flows (register, login, OTP, refresh, …).
- `src/application/services/*`: JWT, session issuance, email OTP, profile resolver.
- `src/domain/entities/`, `src/domain/repositories/`, `src/domain/ports/`: domain layer.
- `src/infrastructure/repositories/*`: TypeORM + in-memory user/refresh-token adapters.
- `src/infrastructure/database/entities/*.orm-entity.ts`: ORM entities.
- `src/infrastructure/redis/`, `outbox/`, `emails/`, `graphile-worker/`: infra adapters.
- `src/integrations/user-profiles/`: user-service gRPC client.
- `src/configuration/*`: environment/config abstraction.
- `migrations/*` and `scripts/sql/*`: database schema.

Architecture: clean/hexagonal (aligned with `user-service`). See `services/auth-service/CLAUDE.md`.

### user-service

Path: `services/user-service`

Technology:

- NestJS 11
- TypeScript
- TypeORM
- PostgreSQL
- gRPC integration to auth-service
- gRPC server for profile operations

Responsibilities:

- Store user profiles separately from auth credentials.
- Create pending profile during registration.
- Get/update current profile.
- Fetch full profile by user id.
- Fetch summary by user id.
- List/search user summaries.
- Bulk hydrate user profiles.
- Provide username/fullName for mentions and identity display.

Important source paths:

- `src/app.module.ts`: dependency wiring.
- `src/app.setup.ts`: global validation and prefix.
- `src/presentation/http/users.controller.ts`: HTTP user endpoints.
- `src/presentation/grpc/user-profiles.grpc.controller.ts`: gRPC profile endpoints.
- `src/application/use-cases/*`: use-case layer.
- `src/domain/entities/*`: domain model classes.
- `src/domain/repositories/user-profile.repository.ts`: repository port.
- `src/infrastructure/repositories/*`: TypeORM and in-memory implementations.
- `src/infrastructure/database/entities/*`: ORM entities.
- `src/integrations/auth/*`: auth gRPC client.
- `migrations/*` and `scripts/sql/*`: database schema.

### workspace-service

Path: `services/workspace-service`

Technology:

- NestJS
- TypeORM
- PostgreSQL
- Kafka outbox via Debezium CDC (`WORKSPACE_OUTBOX_PUBLISH_MODE=debezium`)

Architecture: Clean Architecture — use cases inject domain repository ports; TypeORM adapters in `infrastructure/repositories/`. See `.claude/docs/service-architecture.md`.

Responsibilities:

- Workspace CRUD.
- Workspace membership listing.
- Workspace invitation flow.
- Project CRUD under a workspace.
- Publish `workspace_invited` and `workspace_deleted` events.

Important source paths:

- `src/application/use-cases/workspace|project|invitation/*`
- `src/presentation/http/*controller.ts`
- `src/infrastructure/database/entities/*`
- `src/domain/events/`

Important fact:

- Container port `8080` (host `3002` in Docker override).

Current status:

- Core workspace/project/invite flows implemented.
- Public routes: `AuthGuard` + auth gRPC; dev-only `ALLOW_DEV_IDENTITY_HEADERS`.
- Internal membership API: `GET /workspaces/internal/:id/membership` + Service JWT (task-service client).

### task-service

Path: `services/task-service`

Technology:

- NestJS
- CQRS (`@nestjs/cqrs`)
- Mongoose / MongoDB
- Kafka outbox (Debezium CDC) + Kafka consumers (`workspace_deleted`, user replica sync)

Architecture: clean + CQRS. See `.claude/docs/service-architecture.md`.

Responsibilities:

- Task CRUD, assignment, status changes.
- Comments on tasks.
- User replica sync from user events.
- Publish `task_assigned`, `comment_created`, and `comment_mentioned` events to
  `notification-service`; consume `workspace_deleted` for task cleanup.

Important source paths:

- `src/application/usecases/*.handler.ts`
- `src/application/commands/`, `src/application/queries/`
- `src/domain/entities/`
- `src/infrastructure/persistence/`, `src/infrastructure/repositories/`
- `src/presentation/controllers/`

Current status:

- Task and comment flows implemented.
- `AuthGuard` + `WorkspaceValidationGuard`; workspace membership via internal HTTP + Service JWT.
- `WORKSPACE_CLIENT_MODE=http` (mock only for local tests without workspace).

### notification-service

Path: `services/notification-service`

Technology:

- NestJS
- CQRS
- Mongoose / MongoDB
- Kafka consumer (workspace, user, task events)

Architecture: clean + CQRS, event-first. See `.claude/docs/service-architecture.md`.

Responsibilities:

- Consume task, comment, workspace, and user replica events.
- Persist notifications with `eventId` dedupe.
- List notifications for a user (HTTP).

Important source paths:

- `src/application/usecases/create-notification/`, `get-notifications/`
- `src/infrastructure/messaging/kafka/` — Kafka consumers + DLQ publisher
- `src/infrastructure/database/schemas/`

Current status:

- Event consumers and list API implemented.
- Protected HTTP: `AuthGuard` + auth gRPC (not raw `X-User-Id`).
- Mark-as-read and WebSocket are optional / not required for MVP.

### dlq-service

Path: `services/dlq-service`

Technology:

- NestJS
- Mongoose / MongoDB (`collabspace_dlq`)
- Kafka consumer for `collabspace.dlq.events`
- Kafka producer for replaying records to the original `sourceTopic`

Responsibilities:

- Persist DLQ envelopes as queryable records with status, retry counters, locks, and retry history.
- Provide platform-admin APIs for list/detail/replay/resolve/discard.
- Auto-retry eligible records with bounded backoff and move exhausted records to `requires_manual_review`.
- Expose health, metrics, and Swagger like the other HTTP services.

Important source paths:

- `src/application/dlq-ingest.service.ts`, `dlq-replay.service.ts`
- `src/infrastructure/kafka/` — DLQ consumer + replay producer
- `src/infrastructure/mongo/dlq-record.mongo.repository.ts`
- `src/presentation/controllers/`

Current status:

- DLQ management workflow implemented. Protected HTTP uses `PlatformAdminGuard` and auth gRPC; permissions are `dlq.read` and `dlq.manage`.

### analytics-service

Path: `services/analytics-service`

Technology:

- NestJS
- Mongoose / MongoDB (`collabspace_analytics`)
- Kafka consumers with DLQ publishing
- auth gRPC via `PlatformAdminGuard`

Responsibilities:

- Maintain admin dashboard read models: platform snapshot and daily timeseries.
- Expose admin analytics HTTP routes under `/api/v1/analytics`.
- Expose health, metrics, and Swagger like the other HTTP services.

Important source paths:

- `src/analytics/controllers/analytics.controller.ts`
- `src/analytics/repositories/analytics.repository.ts`
- `src/consumers/*-events.consumer.ts`
- `src/domain/platform-snapshot.schema.ts`
- `src/domain/timeseries-daily.schema.ts`

Current status:

- HTTP API, Mongo repository, health/metrics, Docker Compose, Helm values, and gateway routes are implemented.
- Protected HTTP requires permission `analytics.read` (platform `admin` receives it via auth migration/seed).
- Kafka consumers read canonical user/workspace/task topics and dedupe with `processed_analytics_events`. See `docs/analytics-service.md`.

## Infrastructure

### API Gateway

Path: `api-gateway`

Traefik is the API Gateway. Static config: `traefik.yml`; dynamic: `api-gateway/dynamic`.

Trust boundaries (Phase B):

- `strip-identity-headers` → `forward-auth` → `auth-service` `/verify` on protected public routes.
- Internal paths `/api/v1/*/internal/*` blocked at gateway (503); S2S uses cluster DNS + Service JWT.
- K8s: `infrastructure/k8s/network-policies.yaml` (or Helm `networkPolicies`) — default deny + per-service allow lists.

Correlation ID (Phase C):

- `X-Request-Id` middleware on all HTTP services; S2S HTTP clients forward when present in async context.
- See `.claude/docs/service-contracts.md` → Correlation ID.

Infra operations backlog: `docs/team/phan-phu-tho-infrastructure-backlog.md`.

### Secrets (HashiCorp Vault)

Path: `infrastructure/vault`

- **Local dev:** `infrastructure/docker/docker-compose.vault.yml` (Vault `-dev` on port `8200`); seed/sync scripts under `infrastructure/vault/scripts/`.
- **KV v2:** mount `secret/` — paths `collabspace/dev`, `collabspace/staging`, `collabspace/prod` (shared keys: `jwt_secret`, `service_jwt_secret`, datastore passwords).
- **Kubernetes:** External Secrets Operator manifests in `infrastructure/vault/k8s/` sync Vault → `{app}-secrets`; Helm `global.externalSecrets.enabled: true` skips chart-rendered Secrets.
- **Apps unchanged:** NestJS services read `JWT_SECRET`, `SERVICE_JWT_SECRET`, etc. from environment variables.

Guide: `infrastructure/vault/README.md`.

When changing route prefixes, update:

- Service controllers/global prefixes.
- Traefik routers and services.
- README API route docs.
- Load tests if endpoint paths change.

### Docker Compose

Path: `infrastructure/docker`

Base app stack:

- `docker-compose.yml`: application services.
- `docker-compose.kafka.yml`: Kafka broker, Debezium Connect, kafka-exporter (optional Schema Registry).
- `docker-compose.db.yml`: PostgreSQL, MongoDB, Redis.
- `docker-compose.override.yml`: local host port mappings and source mounts.

Optional stacks:

- `docker-compose.monitoring.yml`: Prometheus, Alertmanager, Grafana.
- `docker-compose.exporters.yml`: Postgres/Redis/Mongo Prometheus exporters.
- `docker-compose.logging.yml`: optional ELK profile (local only — prod K8s uses Loki).
- `docker-compose.tracing.yml`: Jaeger.
- `docker-compose.traefik.yml`: Traefik gateway.
- `docker-compose.loadtest.yml`: k6/load testing.
- `docker-compose.vault.yml`: HashiCorp Vault dev mode (local; port `8200`). **K8s prod:** Vault single-node + ESO — không dùng `-dev` mode.

### Databases

PostgreSQL:

- `collabspace_auth` for auth-service.
- `collabspace_user` for user-service.
- `collabspace_workspace` planned for workspace-service.

MongoDB:

- `collabspace_task` for task-service.
- `collabspace_notification` for notification-service.
- `collabspace_dlq` for dlq-service DLQ records and retry history.
- `collabspace_analytics` for analytics-service snapshots and timeseries.

Redis:

- Auth email verification OTP and refresh/session supporting state.
- Notification caching/realtime support.

### Messaging (Kafka + Debezium CDC)

Cross-service events use **transactional outbox → Debezium → Kafka**. App services do **not** publish directly to the broker after commit.

| Layer | Role |
|-------|------|
| Outbox tables | `workspace_outbox_events`, `user_outbox_events`, `task_outbox_events` (Mongo) |
| Debezium Connect | CDC from Postgres WAL / Mongo change streams; Outbox Event Router SMT |
| Kafka topics | `collabspace.workspace.*`, `collabspace.user.*`, `collabspace.task.*` |
| Consumers | `notification-service`, `task-service` (kafkajs); `analytics-service` read-model consumers; `dlq-service` consumes DLQ topic `collabspace.dlq.events` |

Canonical topic mapping: `.claude/docs/service-contracts.md` → Event Contracts. Ops: `infrastructure/kafka/README.md`, `docs/kafka-debezium-migration-roadmap.md`.

**auth-service** email outbox is separate (Resend transactional email) — not on the Kafka event bus.

Existing event names (topic suffix / contract):

- `TASK_ASSIGNED`
- `WORKSPACE_INVITED`
- `WORKSPACE_DELETED`
- `COMMENT_CREATED`
- `COMMENT_MENTIONED`
- `USER_REGISTERED`
- `USER_PROFILE_UPDATED`

When implementing new events, keep event name, Kafka topic, payload schema, producer (outbox + CDC), consumer, retry/DLQ behavior, and docs aligned. See `.claude/docs/resilience.md` for idempotency, timeouts, and degradation policies.

## Current Completion Snapshot

See [docs/features.md](../../docs/features.md) for the canonical feature matrix (Done / Partial / Planned).

Architecture details per service: `.claude/docs/service-architecture.md`. Resilience status: `.claude/docs/resilience.md`.


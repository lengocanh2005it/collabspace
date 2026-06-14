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
  +--> notification-service  NestJS + CQRS, MongoDB, RabbitMQ consumer

RabbitMQ sits beside services as the async event bus.
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
- RabbitMQ (direct channel publish from use cases)

Architecture: Clean Architecture — use cases inject domain repository ports; TypeORM adapters in `infrastructure/repositories/`. See `.claude/docs/service-architecture.md`.

Responsibilities:

- Workspace CRUD.
- Workspace membership listing.
- Workspace invitation flow.
- Project CRUD under a workspace.
- Publish `workspace_invited` events.

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
- RabbitMQ event publisher

Architecture: clean + CQRS. See `.claude/docs/service-architecture.md`.

Responsibilities:

- Task CRUD, assignment, status changes.
- Comments on tasks.
- User replica sync from user events.
- Publish `task_assigned` and `comment_created` events.

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
- RabbitMQ consumer

Architecture: clean + CQRS, event-first. See `.claude/docs/service-architecture.md`.

Responsibilities:

- Consume task/workspace comment events.
- Persist notifications with `eventId` dedupe.
- List notifications for a user (HTTP).

Important source paths:

- `src/application/usecases/create-notification/`, `get-notifications/`
- `src/presentation/controllers/internal/*-event-listener.controller.ts`
- `src/infrastructure/database/schemas/`

Current status:

- Event consumers and list API implemented.
- Protected HTTP: `AuthGuard` + auth gRPC (not raw `X-User-Id`).
- Mark-as-read and WebSocket are optional / not required for MVP.

## Infrastructure

### API Gateway

Path: `api-gateway`

Traefik is the API Gateway. Static config: `traefik.yml`; dynamic: `api-gateway/dynamic`.

Trust boundaries (Phase B):

- `strip-identity-headers` → `forward-auth` → `auth-service` `/verify` on protected public routes.
- Internal paths `/users/internal/*`, `/workspaces/internal/*` blocked at gateway (503); S2S uses cluster DNS + Service JWT.
- K8s: `infrastructure/k8s/network-policies.yaml` (or Helm `networkPolicies`) — default deny + per-service allow lists.

Correlation ID (Phase C):

- `X-Request-Id` middleware on all five HTTP services; S2S HTTP clients forward when present in async context.
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

- `docker-compose.yml`: application services and RabbitMQ.
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

- `collabspace_task` planned for task-service.
- notification persistence may use MongoDB depending on implementation.

Redis:

- Auth email verification OTP and refresh/session supporting state.
- Notification caching/realtime support.

### Messaging

RabbitMQ is the async event bus.

Canonical exchange from README:

- `collabspace_exchange`, direct type.

Canonical routing keys:

- `task_assigned`
- `workspace_invited`
- `comment_created`

Existing or intended event names:

- `TASK_ASSIGNED`
- `WORKSPACE_INVITED`
- `COMMENT_CREATED`

When implementing new events, keep event name, routing key, queue name, payload schema, producer, consumer, retry/dead-letter behavior, and docs aligned. See `.claude/docs/resilience.md` for idempotency, timeouts, and degradation policies.

## Current Completion Snapshot

See [docs/features.md](../../docs/features.md) for the canonical feature matrix (Done / Partial / Planned).

Architecture details per service: `.claude/docs/service-architecture.md`. Resilience status: `.claude/docs/resilience.md`.


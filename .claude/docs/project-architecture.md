# CollabSpace Project Architecture

## Product Summary

CollabSpace is a collaboration platform demo built around a microservices architecture. The product direction is a compact mix of workspace management, project boards, tasks, comments, mentions, identity, and notifications.

The MVP demo should prove this path:

1. User registers and verifies email.
2. User logs in and receives tokens.
3. User creates a workspace.
4. User invites another member.
5. User creates a project or board.
6. User creates tasks and assigns them.
7. Assignee moves a task across board statuses.
8. User comments and mentions another user by username.
9. Mentioned or assigned user can see a notification/activity item.

## High-Level Runtime Topology

```text
Client
  |
  v
Traefik API Gateway
  |
  +--> auth-service          NestJS, PostgreSQL, Redis, Graphile Worker
  +--> user-service          NestJS, PostgreSQL
  +--> workspace-service     Java/Kotlin planned, PostgreSQL, port 8080
  +--> task-service          Node.js planned, MongoDB
  +--> notification-service  Node.js planned, Redis/Mongo

RabbitMQ sits beside services as the async event bus.
Observability stack includes Prometheus, Grafana, ELK, and Jaeger.
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
- `src/app.controller.ts`: HTTP auth endpoints.
- `src/app.service.ts`: auth orchestration.
- `src/auth.grpc.controller.ts`: gRPC auth verification endpoint.
- `src/configuration/*`: environment/config abstraction.
- `src/modules/identity/*`: user, role, permission, password, auth user logic.
- `src/modules/refresh-tokens/*`: refresh token issuance/rotation/revocation.
- `src/modules/redis/*`: Redis wrapper.
- `src/modules/outbox/*`: auth outbox events.
- `src/modules/graphile-worker/*`: worker integration.
- `migrations/*` and `scripts/sql/*`: database schema.

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

Intended responsibility:

- Workspace CRUD.
- Workspace membership.
- Workspace invitation flow.
- Workspace-level roles: `owner`, `admin`, `member`.
- Publish invitation events for notifications.

Important fact:

- This service is expected to listen on container port `8080`.
- Local Docker override maps host `3002` to container `8080`.

Current status:

- Infrastructure files exist.
- MVP business implementation is pending.

### task-service

Path: `services/task-service`

Intended responsibility:

- Project CRUD.
- Kanban board view.
- Task CRUD.
- Assignment.
- Task status transitions: `todo`, `in_progress`, `done`.
- Priority: `low`, `medium`, `high`.
- Due date and labels.
- Comments and mentions.
- Activity log.
- Publish assignment/comment/mention events for notifications.

Current status:

- Infrastructure files exist.
- MVP business implementation is pending.

### notification-service

Path: `services/notification-service`

Intended responsibility:

- Consume RabbitMQ events.
- Persist notifications.
- List notifications for the current user.
- Mark notifications read if implemented.
- Realtime WebSocket is nice-to-have, not required for MVP.

Current status:

- Infrastructure files exist.
- MVP business implementation is pending.

## Infrastructure

### API Gateway

Path: `api-gateway`

Traefik is used as the API Gateway. Static config lives in `traefik.yml`; dynamic routing lives under `api-gateway/dynamic`.

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

- `docker-compose.monitoring.yml`: Prometheus/Grafana.
- `docker-compose.logging.yml`: ELK.
- `docker-compose.tracing.yml`: Jaeger.
- `docker-compose.traefik.yml`: Traefik gateway.
- `docker-compose.jenkins.yml`: Jenkins.
- `docker-compose.loadtest.yml`: k6/load testing.

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

Done:

- Auth and identity flows.
- User profile/directory flows.
- Auth-to-user pending profile bootstrap through gRPC.
- Auth token verification for downstream identity.
- Basic infrastructure manifests.

Pending:

- Workspace CRUD/membership/invites.
- Project/board/task/comment/activity implementation.
- Notification persistence/list API.
- End-to-end demo wiring across all services.


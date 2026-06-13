# CollabSpace Service Contracts

For dependency failures, timeouts, idempotency, and degradation behavior, see `resilience.md`.

## HTTP API Rules

- **OpenAPI (Swagger UI):** each app service exposes **`GET /swagger`** on its HTTP port with **request/response schemas** (`@ApiOkResponse` / `@ApiCreatedResponse`, DTO `@ApiProperty`). K8s prod: Traefik `http://<HOST>/swagger/<service>` (`gateway.swagger.expose: true`). URL index: [service-urls.md](../../docs/service-urls.md); overview: [README.md](../../README.md#openapi-swagger-ui). Protected routes use Bearer JWT; internal S2S routes document `X-Internal-Service-Token`.
- Implemented NestJS services use global prefix `/api/v1` (task and notification: global `api` + `v1/...` on `@Controller()`).
- Controllers should use resource-oriented paths.
- Auth-required endpoints should verify bearer tokens through auth-service, preferably via existing gRPC integration patterns.
- Responses should be DTO-shaped and stable. Do not leak ORM entities directly from controllers.
- Error responses should include a stable `code` string and a human-readable `message` where the existing service does so.

## Idempotency (`Idempotency-Key` header)

Optional on mutating endpoints. When present, the service stores the first successful response for 24 hours and replays it on duplicate requests with the same key and authenticated user.

| Service | Endpoints | Storage |
|---------|-----------|---------|
| workspace-service | `POST /api/v1/workspaces`, `POST /api/v1/workspaces/:workspaceId/invite` | Postgres `idempotency_records` |
| task-service | `POST /api/v1/tasks`, `PATCH /api/v1/tasks/:id/assignee` | Mongo `idempotency_keys` |

Header: `Idempotency-Key: <opaque-string>` (scoped per `X-User-Id` / gateway identity).

## Auth Service HTTP Routes

Base prefix: `/api/v1`

Routes:

- `GET /api/v1/auth/health`
- `GET /api/v1/auth/health/live`
- `GET /api/v1/auth/health/ready`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/resend-verification-otp` (body: `{ "email": "..." }`)
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/change-password`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/verify`

Behavior notes:

- `register` creates an auth user and calls `user-service` gRPC `CreatePendingProfile`.
- Registration can recover an existing unverified pending user.
- Email verification OTP is hashed before storing in Redis.
- `login` requires verified email.
- Refresh token rotation happens in `TypeOrmRefreshTokenRepository` (port: `REFRESH_TOKEN_REPOSITORY`).
- `change-password` revokes all refresh tokens for the user.
- `verify` returns identity headers for downstream services and gateway-style usage.

Important identity fields:

- `userId`
- `email`
- `emailVerified`
- `role`
- `roles`
- `permissions`
- `fullName`
- `username`
- `workspaceId`

## User Service HTTP Routes

Base prefix: `/api/v1`

Routes:

- `GET /api/v1/users/health`
- `GET /api/v1/users/health/live`
- `GET /api/v1/users/health/ready`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `POST /api/v1/users/bulk`
- `GET /api/v1/users?limit=&offset=&q=`
- `GET /api/v1/users/search?q=&limit=&offset=` if implemented/kept in docs
- `GET /api/v1/users/{id}/summary`
- `GET /api/v1/users/{id}`

Behavior notes:

- User-service verifies incoming bearer tokens through auth-service gRPC.
- `me` always resolves from token identity, not from a user id in the request body.
- Search/list supports user directory and mention flows.
- Bulk fetch exists to hydrate assignees/comment authors efficiently.

## Internal gRPC Contracts

### AuthService.VerifyAccessToken

Provider:

- `auth-service`

Consumer:

- `user-service`
- future workspace/task/notification services

Purpose:

- Validate bearer token.
- Return canonical user identity, roles, permissions, and optional workspace context.

Rules:

- Callers should pass the original `Authorization` header if available.
- Downstream services should not parse or trust JWT payloads directly when auth-service verification is available.
- If a downstream service needs workspace authorization, it must combine auth identity with workspace membership checks.

### UserProfilesService.CreatePendingProfile

Provider:

- `user-service`

Consumer:

- `auth-service`

Purpose:

- Create a pending user profile immediately after auth registration.

Rules:

- The auth user id is the cross-service identity key.
- `fullName` comes from registration input.
- Profile creation should be idempotent or safely handle duplicate pending registration recovery.

### UserProfilesService.GetProfile

Provider:

- `user-service`

Consumer:

- `auth-service`
- future task/workspace/notification services

Purpose:

- Hydrate full profile fields such as `fullName` and `username`.

### UserProfilesService.GetProfiles

Provider:

- `user-service`

Consumer:

- future task/workspace/notification services

Purpose:

- Bulk hydrate profile cards, assignees, members, comment authors, and mention targets.

## Auth Header Propagation

`auth-service` HTTP `verify` may set identity headers for gateway/downstream convenience:

- `X-User-Id`
- `X-User-Name`
- `X-Username`
- `X-Role`
- `X-Roles`
- `X-Permissions`
- `X-Email-Verified`
- `X-Workspace-Id`
- `X-Request-Id`

### Correlation ID (`X-Request-Id`)

- Traefik `forward-auth` forwards `X-Request-Id` to `auth-service` `/verify`, which echoes it on the verify response.
- Every HTTP service runs request-id middleware: read incoming `X-Request-Id` or generate a UUID, attach it to the request, set the response header, and store it in `AsyncLocalStorage` for outbound calls.
- Service-to-service HTTP clients (`task-service` → `workspace-service`, `task-service` / `notification-service` → `user-service`) forward `X-Request-Id` when present in the current async context.
- `task-service` also includes `meta.requestId` in JSON API envelopes when the header is present.

Rules:

- Treat these headers as trusted only if they come from the API gateway or an internal trusted hop.
- The API gateway **strips** client-supplied identity headers (`strip-identity-headers` middleware) before `forward-auth` copies verified values from `auth-service` `/verify`.
- Direct service-to-service calls should prefer gRPC verification unless a gateway authentication middleware is explicitly implemented.
- Never let clients spoof identity headers to bypass auth checks.

## Event Contracts

### User directory replicas (`user_registered`, `user_profile_updated`)

Producer: `user-service` (broadcast to `task-service` and `notification-service` queues).

Consumers: `task-service`, `notification-service` → Mongo collection `user_replicas`.

Payload fields (both events):

```json
{
  "userId": "uuid",
  "fullName": "Jane Doe",
  "username": "jane.doe",
  "displayName": "Jane",
  "avatarUrl": null,
  "email": "uuid@users.collabspace.local",
  "isActive": true,
  "occurredAt": "2026-06-10T00:00:00.000Z"
}
```

Internal hydration (fallback when replica missing): `POST /api/v1/users/internal/replicas` with header `X-Internal-Service-Token`. See `.claude/docs/read-models.md`.

---

Canonical events from README and MVP scope:

### WORKSPACE_INVITED

Producer:

- `workspace-service`

Consumer:

- `notification-service`

Suggested payload:

```json
{
  "eventId": "uuid",
  "eventType": "WORKSPACE_INVITED",
  "occurredAt": "2026-06-06T00:00:00.000Z",
  "workspaceId": "uuid",
  "workspaceName": "Engineering",
  "invitedUserId": "uuid",
  "invitedByUserId": "uuid",
  "role": "member"
}
```

### TASK_ASSIGNED

Producer:

- `task-service`

Consumer:

- `notification-service`

Suggested payload:

```json
{
  "eventId": "uuid",
  "eventType": "TASK_ASSIGNED",
  "occurredAt": "2026-06-06T00:00:00.000Z",
  "workspaceId": "uuid",
  "projectId": "uuid",
  "taskId": "uuid",
  "taskTitle": "Implement board status update",
  "assigneeUserId": "uuid",
  "assignedByUserId": "uuid"
}
```

### COMMENT_CREATED

Producer:

- `task-service`

Consumer:

- `notification-service`

Suggested payload:

```json
{
  "eventId": "uuid",
  "eventType": "COMMENT_CREATED",
  "occurredAt": "2026-06-06T00:00:00.000Z",
  "workspaceId": "uuid",
  "projectId": "uuid",
  "taskId": "uuid",
  "commentId": "uuid",
  "authorUserId": "uuid",
  "mentionedUserIds": ["uuid"]
}
```

Event rules:

- Include `eventId` for idempotency.
- Include `occurredAt` in ISO 8601 UTC.
- Include enough display context for notifications without forcing synchronous reads during consumption.
- Consumers should tolerate unknown fields.
- Producers should not publish events before persistence succeeds.
- Notification consumer should dedupe on `eventId`.

## Workspace MVP Contract

Minimum HTTP routes to close MVP:

- `POST /workspaces`
- `GET /workspaces`
- `GET /workspaces/{id}`
- `PATCH /workspaces/{id}`
- `POST /workspaces/{id}/invite`
- `POST /workspaces/invitations/{invitationId}/accept`
- `GET /workspaces/{id}/members`

Minimum domain concepts:

- Workspace: id, name, description, ownerId, createdAt, updatedAt, deletedAt.
- Membership: workspaceId, userId, role, joinedAt.
- Invitation: workspaceId, invitedEmail or invitedUserId, invitedByUserId, role, status, expiresAt.
- Roles: owner, admin, member.

Authorization baseline:

- Any authenticated user can create a workspace.
- Only owner/admin can invite members.
- Only members can list workspace members.
- Owner cannot be accidentally removed without explicit transfer/ownership handling.

Internal service-to-service (not for browser clients):

- `GET /workspaces/internal/{workspaceId}/membership?userId=` — header `X-Internal-Service-Token`; returns `{ workspaceId, userId, isMember, role }`; `404` when workspace missing.
- Used by `task-service` for membership guards instead of spoofable `X-User-Id` on public routes.
- **Not exposed via Traefik** — call on cluster/service DNS only; gateway returns 503 for `/workspaces/internal/*` and `/users/internal/*`.

## Task MVP Contract

Base prefix: `/api/v1/tasks` (NestJS global prefix `api`; controller `v1/tasks`).

**Canonical route list:** [docs/api-routes.md](../../docs/api-routes.md) § Task Service.

Key routes (implemented):

- `POST /api/v1/tasks` — create (`Idempotency-Key` optional)
- `GET /api/v1/tasks` — list (`workspaceId`, `status`, `assigneeId`, `priority`, `projectId`)
- `GET /api/v1/tasks/board` — Kanban columns `TODO` / `DOING` / `DONE`
- `GET /api/v1/tasks/{id}` — detail
- `GET /api/v1/tasks/{id}/activity` — timeline from `task_events` + comments (`limit`, `offset`)
- `PATCH /api/v1/tasks/{id}/details` — title, description, priority, dueDate, labels
- `PATCH /api/v1/tasks/{id}/status` — change status
- `PATCH /api/v1/tasks/{id}/assignee` — assign (`Idempotency-Key` optional)
- `DELETE /api/v1/tasks/{id}` — soft delete
- `POST|GET|PATCH|DELETE /api/v1/tasks/{taskId}/comments` — comment CRUD + mentions
- `POST|DELETE /api/v1/tasks/{id}/attachments` — upload / remove attachment

Statuses: `TODO`, `DOING`, `DONE`. Priorities: `LOW`, `MEDIUM`, `HIGH`.

Rules:

- Every task belongs to a `workspaceId`; `projectId` optional.
- Workspace membership via internal HTTP + `X-Internal-Service-Token` (not client `X-User-Id`).
- Assignment validates assignee via user replica (+ HTTP fallback).
- Comment mentions parse `@username`, resolve via replica, publish `comment_created` / `comment_mentioned`.

## Notification MVP Contract

Minimum HTTP routes:

- `GET /notifications`
- `PATCH /notifications/{id}/read`
- optional `PATCH /notifications/read-all`

Minimum notification fields:

- id
- recipientUserId
- type
- title
- body
- sourceService
- sourceEntityType
- sourceEntityId
- readAt
- createdAt

Rules:

- MVP does not require WebSocket.
- Notification API should filter by current authenticated user.
- Event consumer must be idempotent.


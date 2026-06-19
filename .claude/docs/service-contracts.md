# CollabSpace Service Contracts

For dependency failures, timeouts, idempotency, and degradation behavior, see `resilience.md`.

## HTTP API Rules

- **OpenAPI (Swagger UI):** each app service exposes **`GET /swagger`** on its HTTP port with **request/response schemas** (`@ApiOkResponse` / `@ApiCreatedResponse`, DTO `@ApiProperty`). K8s prod: Traefik `http://<HOST>/swagger/<service>` (`gateway.swagger.expose: true`). URL index: [service-urls.md](../../docs/service-urls.md); overview: [README.md](../../README.md#openapi-swagger-ui). Protected routes use Bearer user JWT; internal S2S HTTP routes use **Service JWT** (`Authorization: Bearer …`) per [Service-to-Service HTTP Authentication](#service-to-service-http-authentication-service-jwt).
- Implemented NestJS services use global prefix `/api/v1` (task and notification: global `api` + `v1/...` on `@Controller()`).
- Controllers should use resource-oriented paths.
- Auth-required endpoints should verify bearer tokens through auth-service, preferably via existing gRPC integration patterns.
- Responses should be DTO-shaped and stable. Do not leak ORM entities directly from controllers.
- Error responses should include a stable `code` string and a human-readable `message` where the existing service does so.

## Idempotency (`Idempotency-Key` header)

Optional on mutating endpoints. When present, the service stores the first successful response for 24 hours and replays it on duplicate requests with the same key and authenticated user.

| Service           | Endpoints                                                                | Storage                        |
| ----------------- | ------------------------------------------------------------------------ | ------------------------------ |
| workspace-service | `POST /api/v1/workspaces`, `POST /api/v1/workspaces/:workspaceId/invite` | Postgres `idempotency_records` |
| task-service      | `POST /api/v1/tasks`, `PATCH /api/v1/tasks/:id/assignee`                 | Mongo `idempotency_keys`       |

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

## Platform Admin HTTP Contract

All platform admin routes require a fully verified bearer token and either the
platform role `admin` or permission `auth.manage`. Workspace membership uses
`owner`, `manager`, or `member` — never workspace `admin` (removed; see
[docs/roles-and-permissions.md](../../docs/roles-and-permissions.md)). Rejected callers receive
`403` with code `PLATFORM_ADMIN_REQUIRED`.

Auth service:

- `POST /api/v1/auth/admin/roles`
- `POST /api/v1/auth/admin/permissions`
- `POST /api/v1/auth/admin/roles/{roleId}/permissions`
- `DELETE /api/v1/auth/admin/roles/{roleId}/permissions/{permissionId}`
- `POST /api/v1/auth/admin/users/{userId}/roles`
- `GET /api/v1/auth/admin/roles`
- `GET /api/v1/auth/admin/permissions`
- `GET /api/v1/auth/admin/users`
- `PATCH /api/v1/auth/admin/users/{id}/active-status`
- `PUT /api/v1/auth/admin/roles/{id}`
- `DELETE /api/v1/auth/admin/roles/{id}`

Other services:

- `GET /api/v1/users/admin/all`
- `DELETE /api/v1/users/admin/{id}`
- `GET /api/v1/workspaces/admin/all`
- `DELETE /api/v1/workspaces/admin/{id}`
- `POST /api/v1/workspaces/admin/{id}/force-join`
- `POST /api/v1/notifications/admin/broadcast`

Admin status and role changes revoke all refresh tokens for the target user.
Successful login updates `lastLoginAt`; a timestamp write failure is logged but
does not invalidate an already-issued session. Mutations emit structured
`admin_action=...` log entries.

Notification broadcast requires `Idempotency-Key`, supports target `all`, and
uses a persisted fan-out job with one delivery per job and recipient.
`user-service` uses `AUTH_SERVICE_HTTP_URL` and
`AUTH_SERVICE_HTTP_TIMEOUT_MS` for admin aggregation and deactivation.

## User Service HTTP Routes

Base prefix: `/api/v1`

Routes:

- `GET /api/v1/users/health`
- `GET /api/v1/users/health/live`
- `GET /api/v1/users/health/ready`
- `GET /api/v1/users/me` — includes `status` (presence: `online` | `away` | `dnd` | `offline`)
- `PATCH /api/v1/users/me`
- `POST /api/v1/users/me/avatar` — multipart field `file`; updates `avatarUrl` via profile use case
- `POST /api/v1/users/bulk`
- `GET /api/v1/users?limit=&offset=&q=`
- `GET /api/v1/users/search?q=&limit=&offset=` if implemented/kept in docs
- `GET /api/v1/users/{id}/summary`
- `GET /api/v1/users/{id}`

Behavior notes:

- Protected user-service HTTP routes use `AuthGuard` and verify incoming bearer tokens through auth-service gRPC `VerifyAccessTokenLite`.
- Direct-port local testing may use `X-User-Id` only when `ALLOW_DEV_IDENTITY_HEADERS=true`; gateway/client identity headers remain untrusted.
- `me` always resolves from token identity, not from a user id in the request body.
- Search/list supports user directory and mention flows.
- **Directory browse:** `GET /users` and `GET /users/search` require `q` unless caller is platform admin (`403 DIRECTORY_QUERY_REQUIRED`); full list via `GET /users/admin/all`.
- Bulk fetch exists to hydrate assignees/comment authors efficiently.
- Avatar upload: `AZURE_STORAGE_CONNECTION_STRING` optional — without it, service returns a mock avatar URL (`ui-avatars.com`) for local UI; container `user-avatars` when configured.

## Internal gRPC Contracts

### AuthService.VerifyAccessToken

Provider:

- `auth-service`

Consumer:

- Traefik forward-auth (`GET /api/v1/auth/verify`) — **full** verify (profile + permissions)

Purpose:

- Validate bearer token for gateway identity headers.
- Return canonical user identity, roles, permissions, and optional workspace context.

### AuthService.VerifyAccessTokenLite

Provider:

- `auth-service`

Consumer:

- `user-service`, `workspace-service`, `task-service`, `notification-service` — **AuthGuard** hot path

Purpose:

- Lightweight JWT verification for downstream guards: crypto verify + `isActive` check + roles from JWT claims.
- **No** user-service profile gRPC; **no** RBAC permission graph SQL join.
- Optional Redis cache (`AUTH_VERIFY_LITE_CACHE_ENABLED`, default `true`).

Rules:

- Downstream guards should call **Lite**, not full `VerifyAccessToken`.
- Use full verify only when permissions/profile are required (gateway `/auth/verify`, future admin routes).

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

## Service-to-Service HTTP Authentication (Service JWT)

**Status:** Phases 1–5 implemented. **Out of scope for this slice:** gRPC peer auth, mTLS mesh.

### Problem (resolved)

Internal HTTP routes previously accepted a single shared static token with no caller identity, scope, or expiry. **Removed** — callers must use Service JWT only.

### Credential

Callers send a short-lived **service JWT** on internal HTTP:

```http
Authorization: Bearer <service-jwt>
```

Continue to forward `X-Request-Id` on the same request (see Correlation ID above).

In local `NODE_ENV=development` only, inbound services may allow requests without credentials when `SERVICE_JWT_SECRET` is unset (dev bypass for tests).

### Token format

| Field | Value |
| ----- | ----- |
| Algorithm | `HS256` |
| Signing key | `SERVICE_JWT_SECRET` (symmetric; same secret on signers and verifiers in one environment) |
| TTL | **5 minutes** (`exp` − `iat` ≤ 300s) |
| Clock skew | ±30 seconds when verifying `iat` / `exp` |

**Trade-off (Phase 0):** one shared signing secret per environment, not per-service asymmetric keys or JWKS. Simpler for five NestJS services; rotation = dual-key deploy (future hardening).

### Required JWT claims

| Claim | Type | Rules |
| ----- | ---- | ----- |
| `iss` | string | Caller service id (see allow-list below). |
| `aud` | string | Target service id (must match the service verifying the token). |
| `scope` | string[] | At least one scope; must include the scope required by the route (see matrix). |
| `iat` | number | Unix seconds. |
| `exp` | number | Unix seconds; `exp` ≤ `iat` + 300. |

Optional (not required in Phase 0): `jti` for replay auditing.

Example payload (`task-service` → `workspace-service`):

```json
{
  "iss": "task-service",
  "aud": "workspace-service",
  "scope": ["workspace.membership.read"],
  "iat": 1710000000,
  "exp": 1710000300
}
```

### Service identifiers (`iss` / `aud`)

Canonical string values:

| Service | `iss` / `aud` value |
| ------- | ------------------- |
| task-service | `task-service` |
| notification-service | `notification-service` |
| workspace-service | `workspace-service` |
| user-service | `user-service` |

### Scopes and routes (HTTP slice)

| Scope | Route | Method | `aud` | Allowed `iss` |
| ----- | ----- | ------ | ----- | ------------- |
| `workspace.membership.read` | `/api/v1/workspaces/internal/{workspaceId}/membership` | GET | `workspace-service` | `task-service` |
| `user.replicas.read` | `/api/v1/users/internal/replicas` | POST | `user-service` | `task-service`, `notification-service` |

Notes:

- `user.replicas.read` applies to **POST** because the endpoint is a batch **lookup/hydrate** (read model); it does not mutate user profiles.
- Response shapes are unchanged; only authentication changes.

### Caller → callee matrix (Phase 0 scope)

| Caller | Callee | `iss` | `aud` | `scope` |
| ------ | ------ | ----- | ----- | ------- |
| task-service | workspace-service | `task-service` | `workspace-service` | `workspace.membership.read` |
| task-service | user-service | `task-service` | `user-service` | `user.replicas.read` |
| notification-service | user-service | `notification-service` | `user-service` | `user.replicas.read` |

### Inbound verification rules

Services that expose internal HTTP routes:

1. Extract `Authorization: Bearer <token>`.
2. Verify signature with `SERVICE_JWT_SECRET`, then check `aud` matches **this** service, `iss` is in the route allow-list, `scope` contains the required scope, and `exp` / `iat` are valid.
3. In `NODE_ENV=development` only, allow requests with no credentials when `SERVICE_JWT_SECRET` is unset (local test bypass).
4. Otherwise `401` with stable error code (below).

Inbound services need `SERVICE_JWT_SECRET` for JWT verification. They do not mint service JWTs unless they also act as outbound callers in this slice.

### Outbound signing rules

Outbound HTTP clients sign a fresh service JWT per request (default: **new token per outbound call**).

`SERVICE_JWT_SECRET` is required in production; in development, outbound calls are skipped when unset unless dev bypass applies on the callee.

### Environment variables

| Variable | Consumers | Purpose |
| -------- | --------- | ------- |
| `SERVICE_JWT_SECRET` | task-service, notification-service (sign); workspace-service, user-service (verify) | Sign and verify service JWTs. **Must match** across all services in the same environment. |

### Error responses

HTTP status **401** for all S2S auth failures. JSON body uses existing Nest pattern:

| `code` | When |
| ------ | ---- |
| `INTERNAL_ACCESS_DENIED` | Missing credentials, invalid JWT signature, wrong `aud`, expired token, or `SERVICE_JWT_SECRET` not configured. |
| `SERVICE_JWT_SCOPE_DENIED` | Valid JWT but `scope` does not include the route scope. |
| `SERVICE_JWT_ISSUER_DENIED` | Valid JWT but `iss` not allowed for this route. |

Messages are human-readable; clients should branch on `code`.

### Network and gateway (unchanged)

- Traefik still returns **503** for `/api/v1/workspaces/internal/*` and `/api/v1/users/internal/*`.
- K8s NetworkPolicies still restrict which pods may reach internal ports (e.g. only `task-service` → `workspace-service`). Service JWT adds **application-layer** identity and scope on top of B4.

### Shared library (Phase 1+)

Implementation in `@collabspace/shared` (`packages/shared/src/auth/`):

- `signServiceJwt({ iss, aud, scope, secret, ttlSeconds?, now? })` → `string`
- `verifyServiceJwt({ token, secret, expectedAud, requiredScopes, allowedIssuers, now? })` → `VerifiedServiceJwt`
- `extractBearerToken(authorizationHeader)`
- `SERVICE_IDS`, `SERVICE_SCOPES`, TTL/skew constants
- `assertServiceToServiceAccess(options)` — inbound Bearer JWT; throws `ServiceAccessDeniedError`
- `buildOutboundServiceAuthHeaders({ iss, aud, scope, serviceJwtSecret? })` → `{ headers }`
- `isOutboundServiceAuthConfigured({ serviceJwtSecret?, nodeEnv? })`

### Rollout phases

| Phase | Deliverable |
| ----- | ----------- |
| **0** | This contract (no code). |
| **1** | `@collabspace/shared` helpers + unit tests. | ✅ |
| **2** | Inbound verify on workspace-service + user-service. | ✅ |
| **3** | Outbound clients (task → workspace/user, notification → user) send Service JWT. | ✅ |
| **4** | `.env.example`, Vault/Helm, doc sweep. | ✅ |
| **5** | Service JWT only for S2S HTTP. | ✅ |

## Event Contracts

### RabbitMQ wire format

- **Routing keys** (topic exchange `collabspace_exchange`): snake_case — `workspace_invited`, `workspace_deleted`, `task_assigned`, `comment_created`, `comment_mentioned`, `user_registered`, `user_profile_updated`. Do **not** use dotted keys such as `workspace.invited`.
- **Outbox DB event types** (`workspace-service`): `workspace.workspace_invited`, `workspace.workspace_deleted` — mapped to routing keys above before publish (RMQ path; legacy until Phase 6).
- **Message body**: NestJS emit envelope `{ "pattern": "<routing_key>", "data": { ...payload }, "id": "uuid" }`. `workspace-service` outbox publishes this shape; consumers also accept legacy raw JSON (routing key = pattern) during rollout.
- **Bindings**: `infrastructure/deploy/reconcile-rabbitmq-queues.sh` (also end of `run-k8s-full-reset.sh`) binds `collabspace_exchange` → `notification-service` / `task-service` queues. `task-service` / `user-service` may also `emit` directly to consumer queues without exchange.

### Kafka topics (workspace events — Phase 1–3)

Debezium Outbox Event Router on `workspace_outbox_events` (`infrastructure/kafka/connectors/workspace-outbox-connector.json`):

| Outbox `event_type` | Kafka topic | Consumers |
|---------------------|-------------|-----------|
| `workspace.workspace_invited` | `collabspace.workspace.workspace_invited` | `notification-service` |
| `workspace.workspace_deleted` | `collabspace.workspace.workspace_deleted` | `notification-service`, `task-service` |

- **Message value**: expanded domain JSON from outbox `payload` column (`transforms.outbox.table.expand.json.payload=true`).
- **Producer path (Phase 3+)**: `WORKSPACE_OUTBOX_PUBLISH_MODE=debezium` — workspace-service does not publish workspace events to RabbitMQ; CDC only.
- **Consumer env**: `KAFKA_CONSUMERS_ENABLED=true`, `KAFKA_BROKERS`, `KAFKA_GROUP_ID`, topic overrides `KAFKA_TOPIC_WORKSPACE_*`.
- **RMQ workspace listeners** remain in code for prod rollback until Phase 6; local Kafka-only dev sets `RABBITMQ_ENABLED=false` on consumers.

### Kafka topics (user events — Phase 4a–4b)

Debezium Outbox Event Router on `user_outbox_events` (`infrastructure/kafka/connectors/user-outbox-connector.json`):

| Outbox `event_type` | Kafka topic | Consumers |
|---------------------|-------------|-----------|
| `user.profile_updated` | `collabspace.user.profile_updated` | `task-service`, `notification-service` |
| `user.registered` | `collabspace.user.registered` | `task-service`, `notification-service` |

- **Producer path (Phase 4b cutover)**: `USER_OUTBOX_PUBLISH_MODE=debezium` — user-service does not publish user events to RabbitMQ; CDC only.
- **Dual-run (default `rabbitmq`)**: outbox INSERT in same TX as profile write; RMQ broadcast after commit until cutover.
- **Consumer env**: `KAFKA_TOPIC_USER_PROFILE_UPDATED`, `KAFKA_TOPIC_USER_REGISTERED`.

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

Internal hydration (fallback when replica missing): `POST /api/v1/users/internal/replicas` with Service JWT (`user.replicas.read`). See [Service JWT](#service-to-service-http-authentication-service-jwt) and `.claude/docs/read-models.md`.

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
  "invitationId": "uuid",
  "workspaceId": "uuid",
  "workspaceName": "Engineering",
  "recipientId": "uuid",
  "invitedUserId": "uuid",
  "invitedById": "uuid",
  "role": "member"
}
```

Email-only invitations may omit `recipientId` / `invitedUserId` and include
`inviteEmail` instead. `notification-service` resolves `inviteEmail` against the
local `user_replicas` collection (case-insensitive) and creates an in-app
notification when a registered active user is found; otherwise it acknowledges
the event without creating a notification.

### TASK_ASSIGNED

### WORKSPACE_DELETED

Producer: `workspace-service` transactional outbox.

Consumers: `task-service`, `notification-service`.

```json
{
  "eventId": "uuid",
  "occurredAt": "2026-06-14T00:00:00.000Z",
  "workspaceId": "uuid",
  "deletedById": "uuid"
}
```

`task-service` idempotently removes task projections, comments, activity entries,
and event streams belonging to the deleted workspace. `notification-service`
currently creates a deletion notification for `deletedById`; if workspace-service
adds affected member ids later, update the recipient logic.

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
  "taskId": "uuid",
  "taskTitle": "Implement board status update",
  "recipientId": "uuid",
  "actorId": "uuid",
  "actorName": "Jane Doe",
  "actorAvatarUrl": null,
  "assignedAt": "2026-06-06T00:00:00.000Z"
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
  "taskId": "uuid",
  "taskTitle": "Implement board status update",
  "recipientId": "uuid",
  "actorId": "uuid",
  "actorName": "Jane Doe",
  "actorAvatarUrl": null,
  "commentId": "uuid",
  "commentPreview": "Short preview",
  "createdAt": "2026-06-06T00:00:00.000Z"
}
```

### COMMENT_MENTIONED

Producer:

- `task-service`

Consumer:

- `notification-service`

Payload shape matches `COMMENT_CREATED`; `recipientId` is each mentioned user
after excluding the author and the assignee notification recipient.

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
- `GET /workspaces/{id}/invitations` — pending invitations; caller must be workspace member
- `GET /invitations/me` — pending invitations for current user (match invitee email)
- `POST /invitations/{invitationId}/accept`
- `POST /invitations/{invitationId}/reject`
- `GET /workspaces/{id}/members`
- `PATCH /workspaces/{id}/members/{userId}` — body `{ role: "manager" | "member" }`; **only owner**; target cannot be `owner` (**Done**)
- `DELETE /workspaces/{id}/members/{userId}` — remove member/manager or leave; owner cannot be removed

Minimum domain concepts:

- Workspace: id, name, description, ownerId, createdAt, updatedAt, deletedAt.
- Membership: workspaceId, userId, role, joinedAt.
- Invitation: workspaceId, invitedEmail or invitedUserId, invitedByUserId, role, status, expiresAt.
- Workspace roles: `owner`, `manager`, `member` (hierarchy: owner > manager > member).
- Platform roles (`auth-service`): `admin`, `user` — **separate** from workspace membership. See [docs/roles-and-permissions.md](../../docs/roles-and-permissions.md).

Authorization baseline:

- Any authenticated user can create a workspace (creator becomes `owner`).
- `owner` or `manager` can invite; invitees join as `member`.
- `owner` can update workspace settings and delete workspace; `manager` cannot.
- `owner` can promote/demote between `member` and `manager` (**Planned**).
- `owner` can remove `manager` or `member`; `manager` can remove `member` only.
- Only members can list workspace members and activity.
- Owner cannot be removed without ownership transfer (not in MVP).

Internal service-to-service (not for browser clients):

- `GET /workspaces/internal/{workspaceId}/membership?userId=` — Service JWT (`workspace.membership.read`, `aud=workspace-service`); returns `{ workspaceId, userId, isMember, role }`; `404` when workspace missing.
- Used by `task-service` for membership guards instead of spoofable `X-User-Id` on public routes.
- **Not exposed via Traefik** — call on cluster/service DNS only; gateway returns 503 for `/workspaces/internal/*` and `/users/internal/*`.
- Auth details: [Service JWT](#service-to-service-http-authentication-service-jwt).

## Task MVP Contract

Base prefix: `/api/v1/tasks` (NestJS global prefix `api`; controller `v1/tasks`).

**Canonical route list:** [docs/api-routes.md](../../docs/api-routes.md) § Task Service.

Key routes (implemented):

- `POST /api/v1/tasks` — create (`Idempotency-Key` optional)
- `GET /api/v1/tasks` — list (`workspaceId`, `status`, `assigneeId`, `priority`, `projectId`, `q`, `skip`, `limit`); response includes `commentCount`
- `GET /api/v1/tasks/board` — Kanban columns; tasks include `commentCount`
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
- Workspace membership via internal HTTP + Service JWT (not client `X-User-Id`).
- Assignment validates assignee via user replica (+ HTTP fallback).
- Comment mentions parse `@username`, resolve via replica, publish `comment_created` / `comment_mentioned`.

## Notification MVP Contract

Minimum HTTP routes:

- `GET /notifications?status=active|archived`
- `GET /notifications/stream`
- `PATCH /notifications/{id}/read`
- `PATCH /notifications/{id}/archive`
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

- Realtime notification delivery may use SSE on `GET /notifications/stream`; list/read/archive HTTP endpoints remain the source of truth.
- Notification API should filter by current authenticated user.
- Event consumer must be idempotent.

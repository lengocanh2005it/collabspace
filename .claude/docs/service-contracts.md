# CollabSpace Service Contracts

## HTTP API Rules

- Implemented NestJS services use global prefix `/api/v1`.
- Controllers should use resource-oriented paths.
- Auth-required endpoints should verify bearer tokens through auth-service, preferably via existing gRPC integration patterns.
- Responses should be DTO-shaped and stable. Do not leak ORM entities directly from controllers.
- Error responses should include a stable `code` string and a human-readable `message` where the existing service does so.

## Auth Service HTTP Routes

Base prefix: `/api/v1`

Routes:

- `GET /api/v1/auth/health`
- `GET /api/v1/auth/health/live`
- `GET /api/v1/auth/health/ready`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/resend-verification-otp`
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
- Refresh token rotation happens in `RefreshTokensService`.
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

Rules:

- Treat these headers as trusted only if they come from the API gateway or an internal trusted hop.
- Direct service-to-service calls should prefer gRPC verification unless a gateway authentication middleware is explicitly implemented.
- Never let clients spoof identity headers to bypass auth checks.

## Event Contracts

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

## Task MVP Contract

Minimum HTTP routes to close MVP:

- `POST /projects`
- `GET /projects?workspaceId=`
- `GET /projects/{id}`
- `PATCH /projects/{id}`
- `DELETE /projects/{id}`
- `GET /projects/{id}/board`
- `POST /tasks`
- `GET /tasks?workspaceId=&projectId=&assigneeId=&status=&priority=&q=`
- `GET /tasks/{id}`
- `PATCH /tasks/{id}`
- `DELETE /tasks/{id}`
- `POST /tasks/{id}/comments`
- `GET /tasks/{id}/comments`

Minimum statuses:

- `todo`
- `in_progress`
- `done`

Minimum priorities:

- `low`
- `medium`
- `high`

Rules:

- Every task belongs to a workspace and project.
- Assignment should validate user existence through user-service.
- Workspace membership should be checked before task mutation.
- Comment mentions should parse `@username`, resolve through user-service, persist mentioned users, and publish a notification event.

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


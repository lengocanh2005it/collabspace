# CollabSpace API Routes

Human-readable route index for local development and demos. All HTTP services use global prefix `/api` unless noted.

**Canonical contracts** (payloads, headers, events): [`.claude/docs/service-contracts.md`](../.claude/docs/service-contracts.md)  
**Feature status:** [`features.md`](features.md)

## Gateway access

| Mode | Base URL | Notes |
|------|----------|--------|
| Traefik | `http://localhost/api/v1/...` | `strip-identity-headers` → `forward-auth` → `auth-service` `/api/v1/auth/verify` |
| Direct (Docker mapped ports) | See [README — Services](../README.md#services) | Send `Authorization: Bearer …`; dev-only `X-User-Id` when `ALLOW_DEV_IDENTITY_HEADERS=true` |

Common gateway headers after auth: `X-User-Id`, `X-User-Name`, `X-Username`, `X-Role`, `X-Roles`, `X-Permissions`, `X-Email-Verified`, `X-Workspace-Id`, `X-Request-Id`.

Clients must **not** send identity headers — Traefik removes them before forward-auth.

Internal service-to-service paths (`/users/internal/*`, `/workspaces/internal/*`) are **blocked at the gateway**; use Docker/K8s service DNS with `X-Internal-Service-Token`.

## OpenAPI (Swagger UI)

Each service exposes interactive docs at **`/swagger`** on its HTTP port (direct access, not via Traefik path prefix):

| Service | URL (Docker host port) |
|---------|-------------------------|
| auth | http://localhost:3000/swagger |
| user | http://localhost:3001/swagger |
| workspace | http://localhost:3002/swagger |
| task | http://localhost:3003/swagger |
| notification | http://localhost:3004/swagger |

Use **Authorize** with Bearer JWT for protected routes. Internal S2S routes document `X-Internal-Service-Token`.

---

## Auth Service

Base: `/api/v1/auth` · Port **3000** (host **3000**)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/health/live` | Liveness |
| GET | `/health/ready` | Readiness |
| POST | `/register` | Register; create pending profile in user-service; send email OTP |
| POST | `/resend-verification-otp` | Resend OTP (cooldown + max attempts) |
| POST | `/verify-email` | Verify email OTP |
| POST | `/login` | Login → access + refresh tokens |
| POST | `/refresh` | Rotate refresh token |
| POST | `/logout` | Revoke refresh token |
| POST | `/change-password` | Change password; revoke sessions |
| GET | `/me` | Current user from access token |
| GET | `/verify` | Verify bearer token; sets identity headers for downstream services |

**gRPC:** `AuthService.VerifyAccessToken` on port **50051** (container `auth-service:50051`).

---

## User Service

Base: `/api/v1/users` · Port **3000** (host **3001**)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/health/live` | Liveness |
| GET | `/health/ready` | Readiness |
| GET | `/me` | Current user profile |
| PATCH | `/me` | Update profile |
| GET | `/me/preferences` | User preferences |
| PATCH | `/me/preferences` | Update preferences |
| GET | `/me/status` | User status |
| PATCH | `/me/status` | Update status |
| POST | `/bulk` | Bulk profiles by `userIds` |
| GET | `/?limit=&offset=&q=` | List / search summaries |
| GET | `/search?q=&limit=&offset=` | Search summaries |
| GET | `/{id}/summary` | Lightweight summary |
| GET | `/{id}` | Full profile |

**gRPC** (port **50052**):

- `UserProfilesService.CreatePendingProfile` — auth registration bootstrap
- `UserProfilesService.GetProfile` — profile hydration
- `UserProfilesService.GetProfiles` — bulk hydration

---

## Workspace Service

Base: `/api/v1/workspaces` · Port **8080** (host **3002**)

Protected routes require `Authorization: Bearer …` (auth gRPC). Dev-only `X-User-Id` when `ALLOW_DEV_IDENTITY_HEADERS=true`.

| Area | Examples |
|------|----------|
| Workspace | `POST /`, `GET /`, `GET /{id}`, `PATCH /{id}` |
| Members | `GET /{id}/members` |
| Invitations | `POST /{id}/invite`, `POST /invitations/{token}/accept`, `POST /invitations/{token}/reject` |
| Projects | `POST /{workspaceId}/projects`, `GET /{workspaceId}/projects`, `PATCH /projects/{id}`, `DELETE /projects/{id}` |
| Health | `GET /health/live`, `GET /health/ready` |

---

## Task Service

Base: `/api/v1/tasks` · Port **3000** (host **3003**)

Protected routes require `Authorization: Bearer …` (auth gRPC). Dev-only `X-User-Id` when `ALLOW_DEV_IDENTITY_HEADERS=true`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health/live`, `/health/ready` | Health |
| POST | `/` | Create task (`Idempotency-Key` supported) |
| GET | `/` | List tasks (`workspaceId`, `status`, `assigneeId`, `priority`, `projectId`) |
| GET | `/board` | Kanban board grouped by status |
| GET | `/{id}` | Task detail |
| GET | `/{id}/activity` | Activity timeline (`limit`, `offset`) |
| PATCH | `/{id}/details` | Title, description, priority, dueDate, labels |
| PATCH | `/{id}/status` | Change status |
| PATCH | `/{id}/assignee` | Assign / unassign (`Idempotency-Key` supported) |
| DELETE | `/{id}` | Delete task |
| POST | `/{id}/attachments` | Upload attachment (multipart) |
| DELETE | `/{id}/attachments?fileUrl=` | Remove attachment |

**Comments** (base `/api/v1/tasks/{taskId}/comments`): create, list, edit, delete — see service contracts.

**Events published** (outbox → RabbitMQ): `task_assigned`, `comment_created`, `comment_mentioned`.

---

## Notification Service

Base: `/api/v1/notifications` · Port **3000** (host **3004**)

Protected routes require `Authorization: Bearer …` (auth gRPC). Dev-only `X-User-Id` when `ALLOW_DEV_IDENTITY_HEADERS=true`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health/live`, `/health/ready` | Health |
| GET | `/` | List notifications (`skip`, `limit`) |
| PATCH | `/{id}/read` | Mark one notification read |
| PATCH | `/read-all` | Mark all read for current user |

**Events consumed:** `workspace_invited`, `task_assigned`, `comment_created`, `comment_mentioned`.

---

## Related docs

| Document | Use when |
|----------|----------|
| [service-contracts.md](../.claude/docs/service-contracts.md) | Request/response shapes, error codes, event payloads |
| [features.md](features.md) | What is implemented vs planned |
| [mvp-demo-scope.md](mvp-demo-scope.md) | Demo story + acceptance (E2E script planned) |
| [team/phan-phu-tho-infrastructure-backlog.md](team/phan-phu-tho-infrastructure-backlog.md) | Infra/DevOps backlog |

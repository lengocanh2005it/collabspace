# Chỉ mục route API CollabSpace

Route HTTP đọc nhanh cho phát triển local và demo. Mọi service HTTP dùng prefix global `/api` trừ khi ghi chú khác.

**Hợp đồng chính thức** (payload, header, event): [`.claude/docs/service-contracts.md`](../.claude/docs/service-contracts.md)  
**Trạng thái tính năng:** [`features.md`](features.md)  
**URL đầy đủ (API, Swagger, Grafana):** [`service-urls.md`](service-urls.md)

## Truy cập qua gateway

| Chế độ | Base URL | Ghi chú |
|--------|----------|---------|
| Traefik | `http://localhost/api/v1/...` | `strip-identity-headers` → `forward-auth` → `auth-service` `/api/v1/auth/verify` |
| Trực tiếp (Docker mapped ports) | Xem [README — Services](../README.md#services) | Gửi `Authorization: Bearer …`; dev-only `X-User-Id` khi `ALLOW_DEV_IDENTITY_HEADERS=true` |

Header gateway thường gặp sau auth: `X-User-Id`, `X-User-Name`, `X-Username`, `X-Role`, `X-Roles`, `X-Permissions`, `X-Email-Verified`, `X-Workspace-Id`, `X-Request-Id`.

Client **không được** gửi header identity — Traefik xóa trước forward-auth.

Route S2S nội bộ (`/users/internal/*`, `/workspaces/internal/*`) **bị chặn tại gateway**; gọi qua DNS service Docker/K8s. Auth: **Service JWT** (`Authorization: Bearer …`) — contract [service-contracts.md § Service JWT](../.claude/docs/service-contracts.md#service-to-service-http-authentication-service-jwt).

## OpenAPI (Swagger UI)

Mỗi endpoint JSON có **request/response schema** qua `@ApiOkResponse` / `@ApiCreatedResponse` và class DTO có `@ApiProperty`.

### Qua Traefik / K8s gateway (khuyến nghị prod)

Bật `gateway.swagger.expose: true` trong Helm. Mỗi service tại **`/swagger/<tên-rút-gọn>`** (không qua `/api/v1`):

| Service | URL (gateway) |
|---------|----------------|
| auth | `http://<HOST>/swagger/auth` |
| user | `http://<HOST>/swagger/user` |
| workspace | `http://<HOST>/swagger/workspace` |
| task | `http://<HOST>/swagger/task` |
| notification | `http://<HOST>/swagger/notification` |

Ví dụ Droplet: `http://167.172.77.110/swagger/auth`

### Trực tiếp cổng service (Docker local)

| Service | URL (Docker host port) |
|---------|-------------------------|
| auth | http://localhost:3000/swagger |
| user | http://localhost:3001/swagger |
| workspace | http://localhost:3002/swagger |
| task | http://localhost:3003/swagger |
| notification | http://localhost:3004/swagger |

Dùng **Authorize** với Bearer JWT cho route protected. Route S2S nội bộ: Service JWT — xem service-contracts.

---

## Auth Service

Base: `/api/v1/auth` · Cổng **3000** (host **3000**)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/health` | Health check |
| GET | `/health/live` | Liveness |
| GET | `/health/ready` | Readiness |
| POST | `/register` | Đăng ký; tạo profile pending ở user-service; gửi OTP email |
| POST | `/resend-verification-otp` | Gửi lại OTP (cooldown + giới hạn lần) |
| POST | `/verify-email` | Xác thực OTP email |
| POST | `/login` | Đăng nhập → access + refresh token |
| POST | `/refresh` | Xoay refresh token |
| POST | `/logout` | Thu hồi refresh token |
| POST | `/logout-others` | Thu hồi mọi session khác (giữ session hiện tại) |
| POST | `/logout-all` | Thu hồi toàn bộ refresh-token families |
| POST | `/forgot-password` | Gửi email reset (chỉ account đã verify; phản hồi generic) |
| POST | `/reset-password` | Đặt lại mật khẩu bằng token email |
| GET | `/sessions` | List refresh-token session families của user hiện tại |
| DELETE | `/sessions/{familyId}` | Revoke một session family |
| POST | `/change-password` | Đổi mật khẩu; thu hồi session |
| GET | `/me` | User hiện tại từ access token |
| GET | `/verify` | Verify bearer token; set header identity cho service downstream |

**gRPC:** `AuthService.VerifyAccessToken` cổng **50051** (container `auth-service:50051`).

---

## User Service

Base: `/api/v1/users` · Cổng **3000** (host **3001**)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/health` | Health check |
| GET | `/health/live` | Liveness |
| GET | `/health/ready` | Readiness |
| GET | `/me` | Profile user hiện tại |
| PATCH | `/me` | Cập nhật profile |
| POST | `/me/avatar` | Upload avatar (multipart field `file`; Azure Blob hoặc mock local) |
| GET | `/me/preferences` | Tùy chọn user |
| PATCH | `/me/preferences` | Cập nhật tùy chọn |
| GET | `/me/status` | Trạng thái user |
| PATCH | `/me/status` | Cập nhật trạng thái |
| POST | `/bulk` | Bulk profile theo `userIds` |
| GET | `/?limit=&offset=&q=` | List / tìm kiếm summary |
| GET | `/search?q=&limit=&offset=` | Tìm kiếm summary |
| GET | `/{id}/summary` | Summary nhẹ |
| GET | `/{id}` | Profile đầy đủ |

**gRPC** (cổng **50052**):

- `UserProfilesService.CreatePendingProfile` — bootstrap register auth
- `UserProfilesService.GetProfile` — hydrate profile
- `UserProfilesService.GetProfiles` — bulk hydrate

---

## Workspace Service

Base: `/api/v1/workspaces` · Cổng **8080** (host **3002**)

Route protected yêu cầu `Authorization: Bearer …` (auth gRPC). Dev-only `X-User-Id` khi `ALLOW_DEV_IDENTITY_HEADERS=true`.

| Vùng | Ví dụ |
|------|-------|
| Workspace | `POST /`, `GET /`, `GET /{id}`, `PATCH /{id}` |
| Thành viên | `GET /{id}/members` |
| Activity | `GET /{id}/activity` — timeline workspace (`limit`, `offset`) |
| Lời mời | `GET /{id}/invitations`, `POST /{id}/invite`, `POST /invitations/{id}/accept`, `POST /invitations/{id}/reject` |
| Project | `POST /{workspaceId}/projects`, `GET /{workspaceId}/projects`, `PATCH /projects/{id}`, `DELETE /projects/{id}` |
| Health | `GET /health/live`, `GET /health/ready` |

---

## Task Service

Base: `/api/v1/tasks` · Cổng **3000** (host **3003**)

Route protected yêu cầu `Authorization: Bearer …` (auth gRPC). Dev-only `X-User-Id` khi `ALLOW_DEV_IDENTITY_HEADERS=true`.

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/health/live`, `/health/ready` | Health |
| POST | `/` | Tạo task (hỗ trợ `Idempotency-Key`) |
| GET | `/` | List task (`workspaceId`, `status`, `assigneeId`, `priority`, `projectId`) |
| GET | `/board` | Kanban board theo status |
| GET | `/{id}` | Chi tiết task |
| GET | `/{id}/activity` | Timeline activity (`limit`, `offset`) |
| PATCH | `/{id}/details` | Title, description, priority, dueDate, labels |
| PATCH | `/{id}/status` | Đổi status |
| PATCH | `/{id}/assignee` | Gán / bỏ gán (`Idempotency-Key` hỗ trợ) |
| DELETE | `/{id}` | Xóa task |
| POST | `/{id}/attachments` | Upload attachment (multipart) |
| DELETE | `/{id}/attachments?fileUrl=` | Xóa attachment |

**Comment** (base `/api/v1/tasks/{taskId}/comments`): tạo, list, sửa, xóa — xem service contracts.

**Event publish** (outbox → RabbitMQ): `task_assigned`, `comment_created`, `comment_mentioned`.

---

## Notification Service

Base: `/api/v1/notifications` · Cổng **3000** (host **3004**)

Route protected yêu cầu `Authorization: Bearer …` (auth gRPC). Dev-only `X-User-Id` khi `ALLOW_DEV_IDENTITY_HEADERS=true`.

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/health/live`, `/health/ready` | Health |
| GET | `/` | List notification (`skip`, `limit`) |
| PATCH | `/{id}/read` | Đánh dấu một notification đã đọc |
| PATCH | `/read-all` | Đánh dấu tất cả đã đọc cho user hiện tại |

**Event consume:** `workspace_invited`, `task_assigned`, `comment_created`, `comment_mentioned`.

---

## Platform Admin API

All routes below require a bearer token with platform role `admin` or
permission `auth.manage`.

| Service | Method | Path | Description |
|---------|--------|------|-------------|
| auth | POST | `/api/v1/auth/admin/roles` | Create role |
| auth | POST | `/api/v1/auth/admin/permissions` | Create permission |
| auth | POST | `/api/v1/auth/admin/roles/{roleId}/permissions` | Assign permission |
| auth | POST | `/api/v1/auth/admin/users/{userId}/roles` | Assign role and revoke sessions |
| auth | GET | `/api/v1/auth/admin/roles` | List roles |
| auth | GET | `/api/v1/auth/admin/permissions` | List permissions |
| auth | GET | `/api/v1/auth/admin/users` | List accounts including `lastLoginAt` |
| auth | PATCH | `/api/v1/auth/admin/users/{id}/active-status` | Disable/enable account |
| auth | PUT | `/api/v1/auth/admin/roles/{id}` | Update role |
| auth | DELETE | `/api/v1/auth/admin/roles/{id}` | Delete unused non-seed role |
| user | GET | `/api/v1/users/admin/all` | Account and profile aggregate |
| user | DELETE | `/api/v1/users/admin/{id}` | Anonymize and deactivate user |
| workspace | GET | `/api/v1/workspaces/admin/all` | List all workspaces |
| workspace | DELETE | `/api/v1/workspaces/admin/{id}` | Soft delete and cascade by event |
| workspace | POST | `/api/v1/workspaces/admin/{id}/force-join` | Audited admin investigation access |
| notification | POST | `/api/v1/notifications/admin/broadcast` | Queue broadcast; requires `Idempotency-Key` |

`workspace-service` publishes `workspace_deleted`; `task-service` consumes it
and removes task projections, comments, activity, and event streams.

## Tài liệu liên quan

| Tài liệu | Dùng khi |
|----------|----------|
| [service-contracts.md](../.claude/docs/service-contracts.md) | Shape request/response, mã lỗi, payload event |
| [features.md](features.md) | Tính năng đã/chưa implement |
| [mvp-demo-scope.md](mvp-demo-scope.md) | Kịch bản demo + tiêu chí chấp nhận |
| [team/phan-phu-tho-infrastructure-backlog.md](team/phan-phu-tho-infrastructure-backlog.md) | Backlog infra/DevOps |
| [deployment-k3s-phases.md](deployment-k3s-phases.md) | Deploy production |

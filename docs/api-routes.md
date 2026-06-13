# Chỉ mục route API CollabSpace

Route HTTP đọc nhanh cho phát triển local và demo. Mọi service HTTP dùng prefix global `/api` trừ khi ghi chú khác.

**Hợp đồng chính thức** (payload, header, event): [`.claude/docs/service-contracts.md`](../.claude/docs/service-contracts.md)  
**Trạng thái tính năng:** [`features.md`](features.md)

## Truy cập qua gateway

| Chế độ | Base URL | Ghi chú |
|--------|----------|---------|
| Traefik | `http://localhost/api/v1/...` | `strip-identity-headers` → `forward-auth` → `auth-service` `/api/v1/auth/verify` |
| Trực tiếp (Docker mapped ports) | Xem [README — Services](../README.md#services) | Gửi `Authorization: Bearer …`; dev-only `X-User-Id` khi `ALLOW_DEV_IDENTITY_HEADERS=true` |

Header gateway thường gặp sau auth: `X-User-Id`, `X-User-Name`, `X-Username`, `X-Role`, `X-Roles`, `X-Permissions`, `X-Email-Verified`, `X-Workspace-Id`, `X-Request-Id`.

Client **không được** gửi header identity — Traefik xóa trước forward-auth.

Route S2S nội bộ (`/users/internal/*`, `/workspaces/internal/*`) **bị chặn tại gateway**; dùng DNS service Docker/K8s với `X-Internal-Service-Token`.

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

Dùng **Authorize** với Bearer JWT cho route protected. Route S2S nội bộ document `X-Internal-Service-Token`.

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
| Lời mời | `POST /{id}/invite`, `POST /invitations/{token}/accept`, `POST /invitations/{token}/reject` |
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

## Tài liệu liên quan

| Tài liệu | Dùng khi |
|----------|----------|
| [service-contracts.md](../.claude/docs/service-contracts.md) | Shape request/response, mã lỗi, payload event |
| [features.md](features.md) | Tính năng đã/chưa implement |
| [mvp-demo-scope.md](mvp-demo-scope.md) | Kịch bản demo + tiêu chí chấp nhận |
| [team/phan-phu-tho-infrastructure-backlog.md](team/phan-phu-tho-infrastructure-backlog.md) | Backlog infra/DevOps |
| [deployment-k3s-phases.md](deployment-k3s-phases.md) | Deploy production |

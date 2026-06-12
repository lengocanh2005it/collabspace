# CollabSpace — Tính năng sản phẩm

CollabSpace là nền tảng quản lý làm việc nhóm kiểu mini Notion / Slack / Jira: đăng ký tài khoản, tạo workspace, mời thành viên, quản lý project và task, comment có `@mention`, và nhận thông báo.

Tài liệu này là **nguồn chính** mô tả chức năng và mức độ hoàn thiện. Chi tiết API: [`.claude/docs/service-contracts.md`](../.claude/docs/service-contracts.md). Kế hoạch triển khai cho dev/agent: [`.claude/docs/mvp-roadmap.md`](../.claude/docs/mvp-roadmap.md).

---

## Trạng thái

| Ký hiệu | Ý nghĩa |
|---------|---------|
| **Done** | Có API/flow cốt lõi, dùng được trong demo |
| **Partial** | Có một phần; còn thiếu endpoint hoặc trải nghiệm chưa trọn |
| **Planned** | Trong phạm vi MVP nhưng chưa implement |
| **Out of scope** | Không nằm trong MVP hiện tại |

### Tổng quan theo vùng nghiệp vụ

| Vùng | Trạng thái | Ghi chú |
|------|------------|---------|
| Auth & Identity | **Done** | Register, OTP, login, session, `me`, đổi mật khẩu |
| User Directory | **Done** | Profile, tìm kiếm, bulk hydrate, `username` cho mention |
| Workspace | **Done** | CRUD, membership, mời / accept / reject, JWT qua auth gRPC |
| Project | **Done** | CRUD trong workspace (NestJS `workspace-service`) |
| Task & Board | **Done** | Task CRUD, assign, status, board API, priority/due date/labels, xóa task, ES |
| Comment & Mention | **Done** | Comment CRUD, `@username` + replica sync, notification mention |
| Notifications | **Done** | Lưu + list + mark-read; polling API (không WebSocket) |
| Nền tảng (resilience, observability) | **Done** | Health, outbox, idempotency, metrics, tracing profile Docker |

---

## 1. Auth & Identity (`auth-service`)

**Done**

- Đăng ký tài khoản (tạo profile pending ở `user-service` qua gRPC)
- Gửi lại OTP xác thực email (cooldown + giới hạn số lần)
- Xác thực email bằng OTP
- Đăng nhập / refresh token / đăng xuất
- `GET /auth/me` — thông tin user hiện tại; degrade `profileStatus: unavailable` khi user-service down
- `GET /auth/verify` — xác thực token cho gateway/service khác (kèm headers `X-User-Id`, …)
- Đổi mật khẩu (revoke session sau đổi)
- Saga rollback khi tạo profile thất bại sau register

**Out of scope (MVP)**

- Quên mật khẩu / reset password công khai
- Quản trị role/permission qua API công khai
- Quản lý session nâng cao

---

## 2. User Directory (`user-service`)

**Done**

- Xem / cập nhật profile (`fullName`, `username`, `displayName`, `avatarUrl`, `bio`, …)
- Lấy profile theo `userId`, user summary nhẹ cho UI
- Danh sách / tìm kiếm user (phục vụ mention và chọn assignee)
- Bulk lấy profile theo danh sách `userIds`
- gRPC: tạo pending profile, get profile cho auth enrichment
- Preferences và status cơ bản (`/users/me/preferences`, `/users/me/status`)
- Publish event `user_registered` / `user_profile_updated` kèm `username` cho replica downstream

**Out of scope**

- Presence realtime

---

## 3. Workspace (`workspace-service`)

**Done**

- Tạo / xem / cập nhật workspace
- Danh sách workspace của user hiện tại
- Danh sách thành viên workspace
- Mời thành viên (`POST .../invite`) — transactional outbox + event `workspace_invited`
- Chấp nhận / từ chối lời mời
- Role membership: `owner`, `admin`, `member`
- Idempotency-Key trên tạo workspace và invite
- **JWT verification** qua auth gRPC (`AuthGuard`); dev fallback `X-User-Id` khi `ALLOW_DEV_IDENTITY_HEADERS=true`

---

## 4. Project (`workspace-service`)

**Done**

- Tạo project trong workspace
- Liệt kê project theo workspace
- Cập nhật / xóa mềm project
- Kiểm tra membership trước thao tác

**Planned**

- Board Kanban gắn trực tiếp vào project resource (hiện dùng `GET /tasks/board`)

---

## 5. Task (`task-service`)

**Done**

- Tạo task trong workspace (gắn `workspaceId`, `projectId` tùy chọn)
- Danh sách task (lọc `workspaceId`, `status`, `assigneeId`, `priority`, `projectId`)
- **Board API** `GET /tasks/board?workspaceId=` — group theo cột `TODO` / `DOING` / `DONE`
- Chi tiết task
- Cập nhật title / description / **priority** (`LOW`|`MEDIUM`|`HIGH`) / **dueDate** / **labels**
- Đổi status
- Gán assignee — publish event `task_assigned` qua outbox
- **Xóa task** `DELETE /tasks/:id`
- Idempotency-Key trên tạo task và gán assignee
- Kiểm tra membership workspace (internal API + `X-Internal-Service-Token`, không dùng `X-User-Id` S2S)
- **JWT verification** qua auth gRPC (`AuthGuard`); dev fallback `X-User-Id` khi `ALLOW_DEV_IDENTITY_HEADERS=true`
- **Event sourcing** cho aggregate `Task` (create, details, status, assign, delete, **attachments**)
- Upload / xóa attachment — mock Azure khi chưa cấu hình storage; event `TaskAttachmentAdded` / `TaskAttachmentRemoved`

- Activity feed — `GET /api/v1/tasks/:id/activity` trả về timeline task events + comments, sorted by `occurredAt`, `limit`/`offset` pagination

---

## 6. Comment & Mention (`task-service`)

**Done**

- Thêm comment trên task
- Liệt kê comment (ẩn comment đã xóa mềm)
- Sửa / xóa mềm comment
- Parse `@username`, resolve qua **user replica** (`username` sync từ RabbitMQ events); fallback hydrate từ user-service khi thiếu
- Publish `comment_created` (assignee) và `comment_mentioned` (người được tag) qua outbox

- Activity timeline workspace-level — `GET /api/v1/workspaces/:id/activity` — ghi nhận workspace_created, member_invited, member_joined, invitation_rejected, project_created, project_deleted

---

## 7. Notifications (`notification-service`)

**Done**

- Consumer RabbitMQ: `workspace_invited`, `task_assigned`, `comment_created`, `comment_mentioned`, **`user_registered`**, **`user_profile_updated`**
- **User replica** (`user_replicas`) synced from user events; `GET /notifications` enriches actor from replica (fallback to metadata)
- Lưu notification vào MongoDB
- Dedupe theo `eventId` (at-least-once safe)
- **JWT verification** qua auth gRPC (`AuthGuard`); dev fallback `X-User-Id` khi `ALLOW_DEV_IDENTITY_HEADERS=true`
- `GET /notifications` — danh sách notification của user (JWT qua `AuthGuard`)
- `PATCH /notifications/:id/read` — đánh dấu đã đọc
- `PATCH /notifications/read-all` — đánh dấu tất cả đã đọc
- Health live/ready

**Out of scope (MVP)**

- WebSocket / push realtime — client polling `GET /notifications`

---

## 8. Nền tảng & vận hành

Không phải tính năng end-user nhưng hỗ trợ demo và vận hành:

| Khả năng | Trạng thái |
|----------|------------|
| API Gateway (Traefik) | Done |
| Event bus (RabbitMQ) + DLQ | Done |
| Transactional outbox (auth email, workspace invite, task events) | Done |
| Health `/live` + `/ready` | Done |
| Prometheus metrics + Grafana dashboard | Done |
| OpenTelemetry → Jaeger | Done — bật qua `docker-compose.tracing.yml` (`TRACING_ENABLED=true`) |
| Runbooks & failure drills | Done |
| HashiCorp Vault (secrets) | **Partial** — dev Compose + seed/sync + ESO manifests (`infrastructure/vault/`); Vault HA + operational rotation chưa |

Chi tiết: [resilience-overview.md](./resilience-overview.md), [production-hardening.md](./production-hardening.md), [tracing-setup.md](./tracing-setup.md), [infrastructure/vault/README.md](../infrastructure/vault/README.md).

---

## Luồng demo end-to-end (MVP)

Kịch bản mục tiêu khi demo đủ tính năng:

1. User A đăng ký → verify email → đăng nhập
2. User A tạo workspace → mời User B
3. User B accept lời mời
4. User A tạo project → tạo vài task → assign một task cho User B
5. User B đổi task sang `DOING`
6. User A comment và mention `@user-b`
7. User B mở danh sách notification → mark as read

Hướng dẫn chạy demo: [mvp-demo-scope.md](./mvp-demo-scope.md#demo-story).

---

## Ngoài phạm vi MVP

- Sprint, epic, backlog planning phức tạp
- Subtask, dependency giữa task, workflow tùy biến
- Realtime WebSocket toàn hệ thống
- Time tracking, automation rules
- Dashboard / báo cáo nâng cao
- Audit log chi tiết cho compliance
- Frontend client (repo hiện tập trung backend + infra)

---

## Ánh xạ service → chức năng

| Service | Chức năng chính |
|---------|-----------------|
| `auth-service` | Đăng ký, OTP, login, token, `me`, verify |
| `user-service` | Profile, directory, search, gRPC profile |
| `workspace-service` | Workspace, membership, invite, project |
| `task-service` | Task, comment, assign, attachment, board |
| `notification-service` | Notification từ events, list, mark-read |

---

## Tài liệu liên quan

| Tài liệu | Dùng khi |
|----------|----------|
| [cross-service-data.md](./cross-service-data.md) | Cách thay JOIN DB giữa microservices (replica, sync, event) |
| [nfrs.md](./nfrs.md) | Non-functional requirements — thuộc tính chất lượng hệ thống |
| [trade-offs.md](./trade-offs.md) | Quyết định kiến trúc và cái giá phải trả |
| [api-routes.md](./api-routes.md) | Danh sách HTTP routes theo service |
| [mvp-demo-scope.md](./mvp-demo-scope.md) | Tiêu chí chấp nhận MVP + checklist demo |
| [mvp-roadmap.md](../.claude/docs/mvp-roadmap.md) | Thứ tự implement, phase cho dev/agent |
| [service-contracts.md](../.claude/docs/service-contracts.md) | Route, event, header, error codes |
| [project-architecture.md](../.claude/docs/project-architecture.md) | Kiến trúc hệ thống, port, datastore |
| [README.md](../README.md) | Quick start, Docker, team |
| [production-hardening.md](./production-hardening.md) | Prod checklist (Phase B/C) |
| [infrastructure/vault/README.md](../infrastructure/vault/README.md) | HashiCorp Vault — KV paths, local dev, ESO on K8s |
| [backup-policy.md](./backup-policy.md) | Backup RPO/RTO, restore drill |
| [team/phan-phu-tho-infrastructure-backlog.md](./team/phan-phu-tho-infrastructure-backlog.md) | Infra/DevOps (Phan Phú Thọ) |
| [team/application-backlog.md](./team/application-backlog.md) | Logic app, test, E2E, activity feed (Anh, Tiến, Tín) |

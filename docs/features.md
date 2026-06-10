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
| Workspace | **Done** | CRUD, membership, mời / accept / reject |
| Project | **Done** | CRUD trong workspace (NestJS `workspace-service`) |
| Task & Board | **Partial** | Task CRUD, assign, status; chưa có board API riêng, priority, xóa task HTTP |
| Comment & Mention | **Partial** | Comment CRUD; parse mention + event; chưa có activity feed |
| Notifications | **Partial** | Lưu + list qua API; event invite/assign/comment; chưa mark-read, realtime |
| Nền tảng (resilience, observability) | **Partial** | Health, outbox, idempotency, metrics, tracing — xem [resilience-overview.md](./resilience-overview.md) |

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

**Partial / Planned**

- Presence realtime — **Out of scope** MVP

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

**Partial**

- Xác thực user qua gateway header `X-User-Id` (chưa verify JWT trực tiếp với auth gRPC)

---

## 4. Project (`workspace-service`)

**Done**

- Tạo project trong workspace
- Liệt kê project theo workspace
- Cập nhật / xóa mềm project
- Kiểm tra membership trước thao tác

**Planned**

- Board Kanban API riêng (group task theo cột) — hiện client có thể group từ `GET /tasks?status=`

---

## 5. Task (`task-service`)

**Done**

- Tạo task trong workspace (gắn `workspaceId`, project)
- Danh sách task (lọc `workspaceId`, `status`, `assigneeId`)
- Chi tiết task
- Cập nhật title / description
- Đổi status (`todo`, `in_progress`, `done`, …)
- Gán assignee — publish event `task_assigned` qua outbox
- Idempotency-Key trên tạo task và gán assignee
- Kiểm tra membership workspace (HTTP client tới workspace-service)
- **Event sourcing (phase 1)** cho aggregate `Task`: ghi event vào Mongo `task_events`, projection `tasks` cho query; domain events `TaskCreated`, `TaskDetailsUpdated`, `TaskStatusChanged`, `TaskAssigneeChanged`, `TaskDeleted`

**Partial**

- Upload / xóa attachment (Azure Blob) — có API nhưng phụ thuộc cấu hình storage; **chưa** event-sourced (cập nhật projection trực tiếp)
- Handler xóa task có trong codebase nhưng **chưa expose** HTTP endpoint
- Chưa có trường priority / due date / label trong API hiện tại

**Planned**

- Endpoint board (tasks grouped by status)
- Activity feed (ai tạo task, đổi status, comment)

---

## 6. Comment & Mention (`task-service`)

**Done**

- Thêm comment trên task
- Liệt kê comment (ẩn comment đã xóa mềm)
- Sửa / xóa mềm comment
- Parse `@username` và publish event `comment_created` (kèm `eventId`) qua outbox

**Partial**

- Mention resolution dựa trên user replica nội bộ — cần đồng bộ user từ events

**Planned**

- Activity timeline tập trung cho task/workspace

---

## 7. Notifications (`notification-service`)

**Done**

- Consumer RabbitMQ: `workspace_invited`, `task_assigned`, `comment_created`
- Lưu notification vào MongoDB
- Dedupe theo `eventId` (at-least-once safe)
- `GET /notifications` — danh sách notification của user (`X-User-Id`)
- Health live/ready

**Partial**

- Chưa có API mark-as-read (logic domain có sẵn một phần)
- Chưa có WebSocket / push realtime — đọc qua polling API

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
| OpenTelemetry → Jaeger (opt-in `TRACING_ENABLED`) | Partial |
| Runbooks & failure drills | Done |

Chi tiết: [resilience-overview.md](./resilience-overview.md), [production-hardening.md](./production-hardening.md).

---

## Luồng demo end-to-end (MVP)

Kịch bản mục tiêu khi demo đủ tính năng:

1. User A đăng ký → verify email → đăng nhập
2. User A tạo workspace → mời User B
3. User B accept lời mời
4. User A tạo project → tạo vài task → assign một task cho User B
5. User B đổi task sang `in_progress`
6. User A comment và mention `@user-b`
7. User B mở danh sách notification

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
| `task-service` | Task, comment, assign, attachment |
| `notification-service` | Notification từ events, list API |

---

## Tài liệu liên quan

| Tài liệu | Dùng khi |
|----------|----------|
| [mvp-demo-scope.md](./mvp-demo-scope.md) | Tiêu chí chấp nhận MVP + checklist demo |
| [mvp-roadmap.md](../.claude/docs/mvp-roadmap.md) | Thứ tự implement, phase cho dev/agent |
| [service-contracts.md](../.claude/docs/service-contracts.md) | Route, event, header, error codes |
| [project-architecture.md](../.claude/docs/project-architecture.md) | Kiến trúc hệ thống, port, datastore |
| [README.md](../README.md) | Quick start, Docker, team |

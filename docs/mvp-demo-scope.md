# CollabSpace MVP Demo Scope

## Goal

MVP của CollabSpace tập trung vào một luồng demo ngắn nhưng trọn vẹn cho một nền tảng cộng tác kiểu mini Jira:

1. Người dùng đăng ký và xác thực email
2. Tạo workspace
3. Mời thêm thành viên vào workspace
4. Tạo project / board
5. Tạo task và gán người phụ trách
6. Cập nhật trạng thái task trên board
7. Comment và mention `@username`
8. Xem notification hoặc activity cơ bản

## MVP Features

### 1. Auth & Identity

- Đăng ký tài khoản
- Xác thực email bằng OTP
- Đăng nhập
- Refresh token
- Đăng xuất
- Xem thông tin `me`
- Đổi mật khẩu
- Hồ sơ người dùng cơ bản:
  - `fullName`
  - `username`
  - `displayName`
  - `avatarUrl`
  - `bio`

### 2. User Directory

- Lấy profile user theo `userId`
- Tìm user theo `fullName`, `displayName`, `username`
- Lấy user summary để hiển thị trong workspace / task / comment
- Hỗ trợ `@username` cho flow mention
- Presence / status cơ bản là tùy chọn, có thì đẹp hơn cho demo

### 3. Workspace

- Tạo workspace
- Cập nhật thông tin workspace
- Lấy danh sách workspace của tôi
- Mời thành viên vào workspace
- Chấp nhận lời mời
- Xem danh sách thành viên trong workspace
- Gán role ở mức workspace:
  - `owner`
  - `admin`
  - `member`

### 4. Project / Board

- Tạo project trong workspace
- Danh sách project
- Cập nhật project
- Xóa mềm project
- Mỗi project có một board Kanban cơ bản

### 5. Task / Issue

- Tạo task
- Cập nhật task
- Xóa mềm task
- Xem chi tiết task
- Gán assignee
- Cập nhật status:
  - `todo`
  - `in_progress`
  - `done`
- Cập nhật priority:
  - `low`
  - `medium`
  - `high`
- Due date
- Label / tag cơ bản

### 6. Board View

- Xem danh sách task theo cột trạng thái
- Di chuyển task giữa các cột trạng thái
- Lọc task theo assignee
- Lọc task theo status
- Lọc task theo priority
- Search task theo tiêu đề

### 7. Comment & Collaboration

- Comment vào task
- Xem danh sách comment của task
- Mention người dùng bằng `@username`
- Ghi activity cơ bản:
  - ai tạo task
  - ai đổi status
  - ai comment

### 8. Notifications

- Tạo notification khi:
  - được mời vào workspace
  - được assign task
  - bị mention trong comment
- Có API lấy danh sách notification
- Chưa bắt buộc realtime, chỉ cần lưu và đọc được là đủ cho MVP

## Demo Story

Một kịch bản demo đẹp và đủ thuyết phục:

1. User A đăng ký, verify email, đăng nhập
2. User A tạo workspace
3. User A mời User B vào workspace
4. User A tạo project
5. User A tạo 3 task
6. User A assign một task cho User B
7. User B đăng nhập và đổi task từ `todo` sang `in_progress`
8. User A comment vào task và mention `@user-b`
9. User B thấy notification hoặc activity liên quan

## Out of Scope

Các chức năng dưới đây chưa cần cho bản demo MVP:

- Sprint
- Epic
- Backlog planning
- Subtask phức tạp
- Dependency giữa các task
- Workflow tùy biến theo project
- Phân quyền quá chi tiết theo permission matrix
- Realtime WebSocket
- File upload / attachment
- Time tracking
- Automation rule
- Audit log nâng cao
- Dashboard / reporting nâng cao

## MVP Acceptance

Được xem là đủ MVP demo khi hệ thống làm được các việc sau:

- Người dùng có thể đăng ký, verify email và đăng nhập
- Có thể tạo workspace và thêm thành viên
- Có thể tạo project và task trong workspace
- Có thể assign task và đổi trạng thái task
- Có thể comment và mention `@username`
- Có thể xem user profile cơ bản và notification / activity cơ bản

## Implementation Status

Legend:

- `Done` - đã có API hoặc flow cốt lõi
- `Partial` - đã có một phần, nhưng chưa đủ để demo end-to-end
- `Pending` - chưa có hoặc chưa đáng tin cậy để demo

### Current Snapshot

| Area | Status | Notes |
|------|--------|-------|
| Auth & Identity | `Done` | `auth-service` đã có register, verify email OTP, login, refresh, logout, `me`, `verify`, change password |
| User Directory | `Done` | `user-service` đã có profile cơ bản, summary, list/search user, bulk profile, hỗ trợ `username` cho mention |
| Workspace | `Pending` | cần workspace CRUD, membership, invitation, workspace role |
| Project / Board | `Pending` | chưa có board/project MVP hoàn chỉnh |
| Task / Issue | `Pending` | chưa có task CRUD/assign/status flow hoàn chỉnh ở scope demo |
| Comment & Collaboration | `Pending` | phần `@username` đã sẵn ở identity/profile, nhưng comment flow chưa hoàn thiện |
| Notifications | `Pending` | chưa có notification API/demo flow hoàn chỉnh |

### By Service

#### auth-service

- `Done` register
- `Done` resend verification OTP
- `Done` verify email OTP
- `Done` login
- `Done` refresh token
- `Done` logout
- `Done` get current user
- `Done` verify access token for downstream services
- `Done` change password
- `Removed for MVP` password reset public flow
- `Removed for MVP` session management nâng cao
- `Removed for MVP` public role/permission admin APIs

#### user-service

- `Done` get current profile
- `Done` update current profile
- `Done` get user by id
- `Done` get user summary
- `Done` list/search users
- `Done` bulk get profiles
- `Done` gRPC create pending profile
- `Done` gRPC get profile for `fullName` + `username`
- `Removed for MVP` preferences endpoints
- `Removed for MVP` presence/status endpoints

#### workspace-service

- `Pending` workspace CRUD
- `Pending` workspace invitation flow
- `Pending` membership listing
- `Pending` workspace role assignment

#### task-service

- `Pending` project CRUD
- `Pending` board view model
- `Pending` task CRUD
- `Pending` assign assignee
- `Pending` update status / priority / due date
- `Pending` comment flow
- `Pending` activity log

#### notification-service

- `Pending` notification persistence
- `Pending` list notifications API
- `Pending` mention / invitation / assignment notification flow

### MVP Gap To Close

Để có một demo MVP hoàn chỉnh, phần còn thiếu thực tế nằm chủ yếu ở:

1. `workspace-service`: tạo workspace, mời thành viên, membership, workspace roles
2. `task-service`: project/board/task/comment/activity
3. `notification-service`: notification list cơ bản cho invite, assign, mention

## Suggested Service Mapping

### auth-service

- register / verify email / login / refresh / logout
- `me`
- change password
- verify access token

### user-service

- profile cơ bản
- user summary
- search user
- `username` cho mention
- preferences / status nếu cần

### workspace-service

- workspace CRUD
- invitations
- membership
- workspace roles

### task-service

- project
- board
- task CRUD
- assignee
- status / priority / due date
- comment
- activity

### notification-service

- lưu notification
- list notification
- mark as read nếu muốn

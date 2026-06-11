# CollabSpace MVP Demo Scope

Tài liệu này định nghĩa **phạm vi demo MVP** và tiêu chí chấp nhận. Danh sách tính năng chi tiết và trạng thái implement: **[features.md](./features.md)**.

## Goal

MVP tập trung vào một luồng demo ngắn nhưng trọn vẹn:

1. Đăng ký và xác thực email
2. Tạo workspace và mời thành viên
3. Tạo project / task
4. Gán task và đổi trạng thái
5. Comment có `@username`
6. Xem notification

## Demo Story

1. User A đăng ký, verify email, đăng nhập
2. User A tạo workspace → mời User B
3. User B accept lời mời
4. User A tạo project → tạo 3 task → assign một task cho User B
5. User B đổi task từ `todo` sang `in_progress`
6. User A comment và mention `@user-b`
7. User B thấy notification liên quan

## MVP Acceptance

Đủ MVP demo khi:

- [ ] Đăng ký, verify email, đăng nhập
- [ ] Tạo workspace và thêm thành viên (invite + accept)
- [ ] Tạo project và task trong workspace
- [ ] Assign task và đổi trạng thái
- [ ] Comment và mention `@username`
- [ ] User B list được notification (invite / assign / mention)

Checklist chi tiết theo service: [mvp-roadmap.md — Demo Acceptance Checklist](../.claude/docs/mvp-roadmap.md#demo-acceptance-checklist).

## Out of Scope

Xem [features.md — Ngoài phạm vi MVP](./features.md#ngoài-phạm-vi-mvp).

## Gaps còn lại (snapshot)

Cập nhật đầy đủ tại [features.md](./features.md). Tóm tắt:

| Hạng mục | Ghi chú |
|----------|---------|
| Board API riêng | Client group từ list task; chưa có endpoint Kanban |
| Task priority / due date | Chưa có trong API |
| Xóa task qua HTTP | Handler có, endpoint chưa expose |
| Activity feed | Chưa có |
| Notification mark-read / realtime | List API có; chưa mark-read, chưa WebSocket |
| Frontend | Chưa có client UI trong repo |

## Service mapping (tham chiếu nhanh)

Chi tiết route: [service-contracts.md](../.claude/docs/service-contracts.md).

| Service | Trách nhiệm demo |
|---------|------------------|
| auth-service | Auth flow |
| user-service | Profile & directory |
| workspace-service | Workspace, invite, project |
| task-service | Task, comment, assign |
| notification-service | Notification list từ events |

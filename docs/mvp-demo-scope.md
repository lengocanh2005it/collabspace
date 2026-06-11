# CollabSpace MVP Demo Scope

Tài liệu này định nghĩa **phạm vi demo MVP** và tiêu chí chấp nhận. Danh sách tính năng chi tiết và trạng thái implement: **[features.md](./features.md)** (nguồn chính).

## Goal

MVP tập trung vào một luồng demo ngắn nhưng trọn vẹn:

1. Đăng ký và xác thực email
2. Tạo workspace và mời thành viên
3. Tạo project / task
4. Gán task và đổi trạng thái
5. Comment có `@username`
6. Xem notification và đánh dấu đã đọc

## Demo Story

1. User A đăng ký, verify email, đăng nhập
2. User A tạo workspace → mời User B
3. User B accept lời mời
4. User A tạo project → tạo 3 task → assign một task cho User B
5. User B đổi task sang `DOING` (board: cột `TODO` → `DOING`)
6. User A comment và mention `@user-b`
7. User B mở danh sách notification → `PATCH .../read` hoặc `read-all`

## MVP Acceptance — backend API

Các API cốt lõi cho demo (theo [features.md](./features.md)):

- [x] Đăng ký, verify email, đăng nhập
- [x] Tạo workspace và thêm thành viên (invite + accept)
- [x] Tạo project và task trong workspace
- [x] Assign task và đổi trạng thái
- [x] Comment và mention `@username`
- [x] User B list notification (invite / assign / mention) + mark-read

Checklist chi tiết theo service: [mvp-roadmap.md — Demo Acceptance Checklist](../.claude/docs/mvp-roadmap.md#demo-acceptance-checklist).

## Demo verification — chưa đóng

API đã có; còn thiếu **chứng minh tự động** và client:

- [ ] Script demo E2E 7 bước (`scripts/demo-e2e` — chưa có)
- [ ] Smoke qua Traefik gateway (không chỉ curl trực tiếp port service)
- [ ] Frontend / UI client trong repo

## Out of Scope

Xem [features.md — Ngoài phạm vi MVP](./features.md#ngoài-phạm-vi-mvp).

## Gaps còn lại (snapshot)

Cập nhật đầy đủ tại [features.md](./features.md). Tóm tắt **sau khi sync 2026-06**:

| Hạng mục | Trạng thái | Ghi chú |
|----------|------------|---------|
| Board API | **Done** | `GET /tasks/board?workspaceId=` |
| Task priority / due date / labels | **Done** | PATCH task details |
| Xóa task | **Done** | `DELETE /tasks/:id` |
| Notification mark-read | **Done** | `PATCH /notifications/:id/read`, `read-all` |
| Activity feed | **Planned** | Timeline task/workspace |
| WebSocket realtime | **Out of scope** | Polling `GET /notifications` |
| Frontend | **Out of scope** | Backend + infra trong repo |
| Demo E2E script | **Planned** | Tự động hóa 7 bước demo |
| Infra prod-ready | **In progress** | [phan-phu-tho-infrastructure-backlog.md](./team/phan-phu-tho-infrastructure-backlog.md) |
| App logic / test / E2E | **In progress** | [application-backlog.md](./team/application-backlog.md) |

## Service mapping (tham chiếu nhanh)

Chi tiết route: [service-contracts.md](../.claude/docs/service-contracts.md).

| Service | Trách nhiệm demo |
|---------|------------------|
| auth-service | Auth flow |
| user-service | Profile & directory |
| workspace-service | Workspace, invite, project |
| task-service | Task, board, comment, assign |
| notification-service | Notification list + mark-read từ events |

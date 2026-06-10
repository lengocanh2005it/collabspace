# CollabSpace MVP Roadmap

Kế hoạch triển khai cho developer và AI agent. **Danh sách tính năng và trạng thái hiện tại:** [docs/features.md](../../docs/features.md). **Tiêu chí demo:** [docs/mvp-demo-scope.md](../../docs/mvp-demo-scope.md).

## MVP Demo Goal

1. User A registers → verifies email → logs in
2. User A creates workspace → invites User B
3. User B accepts invitation
4. User A creates project and tasks → assigns one to User B
5. User B moves task to `in_progress`
6. User A comments with `@user-b`
7. User B lists notifications

## Recommended Build Order

Các phase dưới đây phản ánh thứ tự implement lịch sử. Nhiều mục đã **Done** — xem [features.md](../../docs/features.md) trước khi làm trùng.

### Phase 1: Auth/User base — **Done**

- Migrations, seed, auth register → verify → login → me
- User profile CRUD, list/search/bulk, gRPC integrations

### Phase 2: Workspace MVP — **Done**

- Workspace CRUD, membership, invite/accept/reject, roles
- Outbox + `workspace_invited` event, idempotency keys

### Phase 3: Project MVP — **Done**

- Project CRUD trong `workspace-service`

### Phase 4: Task MVP — **Mostly done**

- Task create/list/detail, status, assignee, workspace guard
- Outbox events, idempotency, workspace HTTP client

**Remaining:** expose delete-task HTTP, priority/due date, board endpoint

### Phase 5: Comments & mentions — **Mostly done**

- Comment CRUD, mention parse, `comment_created` event

**Remaining:** activity feed

### Phase 6: Notification MVP — **Mostly done**

- Consumers, persistence, dedupe `eventId`, list API

**Remaining:** mark-as-read API, optional realtime

### Phase 7: Platform hardening — **In progress**

- Resilience phases 0–4, observability stack
- See [resilience.md](./resilience.md)

## Demo Acceptance Checklist

- **Auth:** register → OTP → login → `/me` with profile
- **User:** search/list/bulk by username
- **Workspace:** create → invite → accept → member list
- **Project:** create in workspace
- **Task:** create → assign → status `todo` → `in_progress`
- **Comment:** add with `@username` → mention in event payload
- **Notification:** User B lists invite, assign, mention notifications

## Good First Slice (khi tiếp tục MVP)

Ưu tiên đóng gap từ [features.md](../../docs/features.md):

1. `PATCH /notifications/:id/read` (hoặc tương đương)
2. `DELETE /tasks/:id` HTTP endpoint (handler đã có)
3. Board query hoặc document client grouping contract
4. Activity feed tối thiểu trên task

Nếu chưa rõ service nào: đọc [service-architecture.md](./service-architecture.md) và [features.md](../../docs/features.md) trước.

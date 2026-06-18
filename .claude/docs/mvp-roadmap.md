# CollabSpace MVP Roadmap

Kế hoạch triển khai cho developer và AI agent. **Danh sách tính năng và trạng thái hiện tại:** [docs/features.md](../../docs/features.md). **Tiêu chí demo:** [docs/mvp-demo-scope.md](../../docs/mvp-demo-scope.md).

## MVP Demo Goal

1. User A registers → verifies email → logs in
2. User A creates workspace → invites User B
3. User B accepts invitation
4. User A creates project and tasks → assigns one to User B
5. User B moves task to `DOING`
6. User A comments with `@user-b`
7. User B lists notifications → mark as read

## Recommended Build Order

Các phase dưới đây phản ánh thứ tự implement lịch sử. **Luôn đọc [features.md](../../docs/features.md) trước khi làm trùng.**

### Phase 1: Auth/User base — **Done**

- Migrations, seed, auth register → verify → login → me
- User profile CRUD, list/search/bulk, gRPC integrations

### Phase 2: Workspace MVP — **Done**

- Workspace CRUD, membership, invite/accept/reject, roles
- Outbox + `workspace_invited` event, idempotency keys

### Phase 3: Project MVP — **Done**

- Project CRUD trong `workspace-service`

### Phase 4: Task MVP — **Done**

- Task CRUD, list/detail, status, assignee, workspace guard
- Board API, priority/due date/labels, `DELETE /tasks/:id`
- Outbox events, idempotency, workspace internal HTTP client + Service JWT
- Event sourcing aggregate Task, attachments (mock Azure)

### Phase 5: Comments & mentions — **Done**

- Comment CRUD, mention parse, `comment_created` / `comment_mentioned` events
- User replica sync + HTTP fallback hydrate

**Remaining:** workspace-level activity feed (`GET /workspaces/:id/activity`). Task-level **Done:** `GET /tasks/:id/activity`.

### Phase 6: Notification MVP — **Done**

- Consumers, persistence, dedupe `eventId`, list API
- `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`
- User replica enrichment on list
- SSE realtime invalidation stream for FE notification badge/list

### Phase 7: Platform hardening — **In progress**

| Sub-phase | Nội dung | Trạng thái |
|-----------|----------|------------|
| 7.0 | Resilience phases 0–4 (health, outbox, metrics, chaos scripts) | **Done** |
| 7.B | Trust boundaries — JWT gRPC, gateway strip, Service JWT S2S, NetworkPolicy | **Done** |
| 7.C | Correlation ID `X-Request-Id` middleware + S2S forward | **Done** |
| 7.infra | Vault HA + ESO deploy, CI/CD, backup cron, Loki/alert routing, staging deploy | **Partial** — K8s observability ✅ [observability.md](../../docs/observability.md); Vault scaffold [infrastructure/vault/](../../infrastructure/vault/); [phan-phu-tho-infrastructure-backlog.md](../../docs/team/phan-phu-tho-infrastructure-backlog.md) |

Chi tiết resilience: [resilience.md](./resilience.md), [resilience-overview.md](../../docs/resilience-overview.md).

## Demo Acceptance Checklist

- **Auth:** register → OTP → login → `/me` with profile
- **User:** search/list/bulk by username
- **Workspace:** create → invite → accept → member list
- **Project:** create in workspace
- **Task:** create → assign → status `TODO` → `DOING` (board columns)
- **Comment:** add with `@username` → mention in event payload
- **Notification:** User B lists invite, assign, mention → mark-read

## Good First Slice (khi tiếp tục)

Ưu tiên từ [features.md](../../docs/features.md) và [mvp-demo-scope.md](../../docs/mvp-demo-scope.md):

1. **E2E per service + CI smoke** — `scripts/demo-e2e` đã có; gắn pipeline + `*.e2e-spec.ts` workspace/task/notification
2. **Workspace activity feed** — task timeline đã Done; workspace-level aggregate chưa có route
3. **Contract test** (Pact/schema) — backlog; **OpenAPI 5/5** ✅ (Swagger UI + response schemas + gateway `/swagger/<service>`)
4. **Infra** — theo backlog Phan Phú Thọ (secrets, backup, CI) nếu role infra

Nếu chưa rõ service nào: đọc [service-architecture.md](./service-architecture.md) và [features.md](../../docs/features.md) trước.

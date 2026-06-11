# Backlog application logic — Lê Ngọc Anh, Ngô Quang Tiến, Võ Trung Tín

Tài liệu này liệt kê **việc còn lại về logic code / API / test / demo** sau khi rà soát codebase (2026-06).  
**Nguồn chính trạng thái tính năng:** [features.md](../features.md). **Infra/DevOps:** [phan-phu-tho-infrastructure-backlog.md](./phan-phu-tho-infrastructure-backlog.md) (Phan Phú Thọ).

## Tóm tắt rà soát

| Kết luận | Chi tiết |
|----------|----------|
| **MVP API backend** | Luồng 7 bước demo **đã có endpoint** — [mvp-demo-scope.md](../mvp-demo-scope.md) |
| **Không có `TODO`/`FIXME`** trong `services/**` | Gap chủ yếu là tính năng Planned, test, OpenAPI, automation |
| **Thiếu lớn nhất** | Script demo E2E, activity feed, test e2e workspace/task/notification |
| **Rủi ro cấu hình** | `WORKSPACE_CLIENT_MODE` ≠ `http` → task dùng mock workspace (bỏ qua membership thật) |

### Phân công (theo [README.md](../../README.md#team))

| Thành viên | Service / vùng | File backlog |
|------------|----------------|--------------|
| Phan Phú Thọ | Infra, CI/CD, backup, secrets | [phan-phu-tho-infrastructure-backlog.md](./phan-phu-tho-infrastructure-backlog.md) |
| **Lê Ngọc Anh** | `auth-service`, `user-service` | [§ Lê Ngọc Anh](#lê-ngọc-anh--auth--user) |
| **Ngô Quang Tiến** | `workspace-service`, tích hợp workspace ↔ task | [§ Ngô Quang Tiến](#ngô-quang-tiến--workspace--task-integration) |
| **Võ Trung Tín** | `task-service` (task/comment/notify path), `notification-service`, demo E2E | [§ Võ Trung Tín](#võ-trung-tín--task--notification--demo) |

---

## Ưu tiên chung (cả team)

```text
P0  Demo E2E script 7 bước qua Traefik     →  chứng minh MVP (lead: Võ Trung Tín)
P1  Activity feed tối thiểu               →  gap product duy nhất (Võ Trung Tín)
P1  Test coverage + e2e per service       →  Anh / Tiến / Tín theo service
P1  OpenAPI workspace + notification      →  Tiến + Tín
P2  Tech debt (Kafka dead code, console.log, mock paths) →  theo service
```

### P0 — Demo E2E (phối hợp 3 dev)

| # | Việc | Owner chính | Hỗ trợ |
|---|------|-------------|--------|
| 1 | Tạo `scripts/demo-e2e.sh` + `scripts/demo-e2e.ps1` — 7 bước [mvp-demo-scope](../mvp-demo-scope.md) | **Võ Trung Tín** | Anh (auth/OTP), Tiến (workspace/invite) |
| 2 | Chạy qua **Traefik** (`http://localhost/api/v1/...`), không chỉ port 3000–3004 | **Võ Trung Tín** | Phú Thọ (gateway stack) |
| 3 | Tích hợp seed: `scripts/seed.sh`, `scripts/demo-seed-data.json`, `scripts/load-demo-seed-data.ts` | **Võ Trung Tín** | Anh (auth/user seed) |
| 4 | Exit code ≠ 0 nếu bước fail; in `X-Request-Id` khi debug | **Võ Trung Tín** | — |
| 5 | (Sau P0) Gắn script vào CI smoke — backlog infra Phú Thọ | Phan Phú Thọ | Tín |

**Definition of Done:** một lệnh chạy trọn story; pass trên Docker Compose + Traefik profile.

---

## Lê Ngọc Anh — Auth & User

**Services:** `services/auth-service`, `services/user-service`

### Đã xong (không làm lại)

- Register → OTP → verify → login → refresh → logout → change password
- `GET /auth/me`, `GET /auth/verify` (gateway)
- gRPC `VerifyAccessToken`, user profile gRPC
- User profile CRUD, search, bulk, preferences, status
- Events `user_registered`, `user_profile_updated`
- Register saga rollback; Redis down → `503 REDIS_UNAVAILABLE`

### Việc còn lại

#### P1 — Chất lượng & test

- [ ] **Unit test use-case user-service** — hiện chỉ 2/12 use case có spec:
  - Có spec: `get-user-profile`, `lookup-user-replicas`
  - Thiếu spec: `create-pending-user-profile`, `update-user-profile`, `bulk-get-user-profiles`, `list-user-summaries`, `get-user-summary`, `get/update-user-preferences`, `get/update-user-status`, `verify-user-profile-email`
  - Thư mục: `services/user-service/src/application/use-cases/`
- [ ] **auth `IdentityService`** — thêm spec tập trung (logic đang test gián tiếp qua `app.service.spec.ts`)
  - `services/auth-service/src/modules/identity/identity.service.ts`
- [ ] **E2E thực tế hơn** — `services/auth-service/test/app.e2e-spec.ts`, `user-service/test/app.e2e-spec.ts` đang mock gRPC/DB nặng; thêm optional profile integration với stack Docker
- [ ] **Internal replica API** — test `POST /api/v1/users/internal/replicas`
  - `services/user-service/src/presentation/http/internal-users.controller.ts`
- [ ] **RabbitMQ consumer** `auth-events` — test controller
  - `services/user-service/src/presentation/rabbitmq/auth-events.controller.ts`

#### P2 — OpenAPI & polish

- [ ] Swagger **decorator** cho DTO/controller (`@ApiTags`, `@ApiOperation`, `@ApiProperty`) — auth + user đã mount Swagger trong `main.ts` nhưng coverage mỏng
- [ ] Document flow OTP / resend cooldown trong Swagger description

#### Out of scope MVP (ghi nhận, không ưu tiên)

- Quên mật khẩu / reset password public API
- Quản trị role/permission qua HTTP

**DoD giai đoạn Anh:** ≥ 8/12 user use cases có unit test; auth identity có spec riêng; e2e auth register→login→me pass trên stack local.

---

## Ngô Quang Tiến — Workspace & task integration

**Services:** `services/workspace-service` + phần **task ↔ workspace** trong `task-service`

### Đã xong

- Workspace CRUD, members, invite/accept/reject, roles
- Project CRUD trong workspace
- Outbox `workspace_invited`, idempotency workspace/invite
- Internal `GET /workspaces/internal/:id/membership` + `X-Internal-Service-Token`
- `AuthGuard` JWT gRPC; 13/13 use case workspace có `*.use-case.spec.ts`

### Việc còn lại

#### P1 — Test & an toàn tích hợp task

- [ ] **E2E workspace-service** — có `test/jest-e2e.json`, **chưa có** `*.e2e-spec.ts`
  - Flow: create workspace → invite → accept → list members
- [ ] **`auth.guard.spec.ts`** — workspace JWT / dev header
  - `services/workspace-service/src/presentation/http/guards/auth.guard.ts`
- [ ] **Outbox processor test** — `workspace-outbox.processor.ts`
  - `services/workspace-service/src/infrastructure/outbox/`
- [ ] **Task-service: bắt buộc `WORKSPACE_CLIENT_MODE=http`** trên staging/prod — document + fail startup nếu mock mode trong `NODE_ENV=production`?
  - `services/task-service/src/app.module.ts` (factory `WorkspaceHttpClient` vs `WorkspaceMockService`)
  - `services/task-service/src/infrastructure/services/workspace.mock.service.ts` — mock **không** kiểm membership thật
- [ ] **Hỗ trợ Tín:** review contract internal membership khi viết demo E2E bước 2–4

#### P2 — OpenAPI & mở rộng (Planned)

- [ ] **Thêm Swagger** — `workspace-service/src/main.ts` (hiện không có SwaggerModule)
- [ ] **Project-scoped board** (Planned trong [features.md](../features.md) §4) — tùy chọn; hiện board ở `GET /tasks/board` (task-service, owner Tín)

#### P2 — API ngoài MVP (tùy product)

- [ ] Remove member / đổi role member qua HTTP (chưa có — không block demo)

**DoD giai đoạn Tiến:** workspace e2e green; guard + outbox có test; task-service không dùng workspace mock trên môi trường demo “giả prod”.

---

## Võ Trung Tín — Task, Notification & demo

**Services:** `services/task-service`, `services/notification-service` + **lead demo E2E**

### Đã xong

- Task CRUD, board, status, assignee, priority/due date/labels, delete
- Comments CRUD, `@mention`, outbox `comment_created` / `comment_mentioned`
- Attachments (Azure hoặc mock)
- Event sourcing Task aggregate
- Notification consumers, dedupe `eventId`, list + mark-read + read-all
- User replica sync (task + notification)

### Việc còn lại

#### P0 — Demo automation (lead)

- [ ] Xem mục [P0 — Demo E2E](#p0--demo-e2e-phối-hợp-3-dev) ở trên

#### P1 — Tính năng Planned

- [ ] **Activity feed** — timeline task/workspace (ai tạo, đổi status, comment)
  - Chưa có route/handler/schema — chỉ có trong [features.md](../features.md) §5–6
  - Gợi ý slice MVP:
    1. `GET /api/v1/tasks/:taskId/activity` — đọc từ `task_events` projection hoặc collection `task_activity`
    2. (Tuỳ chọn) `GET /api/v1/workspaces/:id/activity` — aggregate gần đây
  - Files liên quan hiện có: `task-event.schema.ts`, `mongo-task-event.store.ts`, handlers trong `application/usecases/`

#### P1 — Test gaps

- [ ] **`get-task-board.handler.spec.ts`** — thiếu
  - `services/task-service/src/application/usecases/get-task-board.handler.ts`
- [ ] **`mark-all-notifications-read.handler.spec.ts`** — thiếu
  - `services/notification-service/src/application/usecases/mark-all-notifications-read/`
- [ ] **E2E task-service** — chỉ có `test-api.sh` thủ công; thêm `test/*.e2e-spec.ts`
- [ ] **E2E notification-service** — tương tự workspace
- [ ] **Event listener specs** — bổ sung cho:
  - `user-event-listener.controller.ts`
  - `comment-mention-event-listener.controller.ts`
  - (đã có spec một phần: `task-comment-event-listener.controller.spec.ts`)

#### P2 — Tech debt & OpenAPI

- [ ] **Xóa Kafka dead code** — runtime chỉ RabbitMQ:
  - `services/notification-service/package.json` (`kafka-node`)
  - `src/domain/events/kafka-event-wrapper.ts`, `kafka-event-payloads.ts`
- [ ] **Xóa / sửa `getAzureStorageConfig()`** không dùng trong `notification-service` và `task-service` `configuration.service.ts`
- [ ] **Swagger notification-service** — thêm vào `main.ts`
- [ ] **Swagger task** — bổ sung `@ApiTags` comment controller; chuẩn hóa prefix docs (`/api/docs` vs `/swagger` các service khác)
- [ ] Thay `console.log` bằng `Logger` (có `requestId` khi Phase C+ structured log):
  - `task-service/src/main.ts`, RMQ listeners
  - `notification-service` comment listener
- [ ] **Attachment Azure** — document rõ mock vs prod trong `task-service/CLAUDE.md` / `.env.example`

#### Out of scope MVP

- WebSocket push notification
- HTTP archive notification (domain `Notification.archive()` chưa expose route)

**DoD giai đoạn Tín:** demo E2E pass; activity feed task-level đọc được; board + mark-all-read có unit test; notification bỏ kafka-node.

---

## Ma trận theo service (tham chiếu nhanh)

| Service | Logic MVP | Gap chính | Owner |
|---------|-----------|-----------|--------|
| auth-service | Done | Test identity, Swagger decorators | Anh |
| user-service | Done | 10 use case thiếu unit test | Anh |
| workspace-service | Done | E2E, Swagger, outbox test | Tiến |
| task-service | Done | Activity feed, board test, e2e, workspace mock guard | Tín (+ Tiến integration) |
| notification-service | Done | mark-all test, e2e, Kafka cleanup, Swagger | Tín |

---

## Cross-cutting (chia hoặc pair programming)

| Hạng mục | Ghi chú | Gợi ý owner |
|----------|---------|-------------|
| Structured logging + `requestId` trong log line | Phase C đã có middleware | Tín (task/notif listeners) + Anh (auth) — **không** infra ELK |
| OpenAPI 5/5 services | [nfrs.md](../nfrs.md) ⚠️ | Anh 2, Tiến 1, Tín 2 |
| Contract sync sau đổi API | `service-contracts.md`, `api-routes.md` | Người mở PR |
| `scripts/load-demo-seed-data` build artifacts | `.js/.d.ts` gitignored — chạy từ `.ts` hoặc commit policy | Tín + Phú Thọ (CI) |

---

## Checklist sprint (copy)

| # | Việc | Owner | P |
|---|------|-------|---|
| 1 | `scripts/demo-e2e` sh + ps1 | Tín | P0 |
| 2 | E2E qua Traefik | Tín | P0 |
| 3 | Activity feed `GET .../tasks/:id/activity` | Tín | P1 |
| 4 | User use-case tests (batch 1: create/update/bulk) | Anh | P1 |
| 5 | User use-case tests (batch 2: preferences/status) | Anh | P1 |
| 6 | auth IdentityService spec | Anh | P1 |
| 7 | workspace e2e spec | Tiến | P1 |
| 8 | workspace Swagger | Tiến | P2 |
| 9 | WORKSPACE_CLIENT_MODE=http enforce prod | Tiến | P1 |
| 10 | get-task-board unit test | Tín | P1 |
| 11 | mark-all-read unit test | Tín | P1 |
| 12 | notification e2e spec | Tín | P1 |
| 13 | Remove kafka-node dead code | Tín | P2 |
| 14 | notification Swagger | Tín | P2 |

---

## Tài liệu liên quan

| Tài liệu | Mục đích |
|----------|----------|
| [features.md](../features.md) | Trạng thái tính năng canonical |
| [mvp-demo-scope.md](../mvp-demo-scope.md) | 7 bước demo + acceptance |
| [mvp-roadmap.md](../../.claude/docs/mvp-roadmap.md) | Phase lịch sử |
| [service-contracts.md](../../.claude/docs/service-contracts.md) | Route, event, header |
| [phan-phu-tho-infrastructure-backlog.md](./phan-phu-tho-infrastructure-backlog.md) | Việc infra (không trùng file này) |

---

*Cập nhật: 2026-06-11 — rà soát `services/*`, `docs/features.md`, không quét infra. Điều chỉnh khi merge PR thay đổi contract hoặc ownership.*

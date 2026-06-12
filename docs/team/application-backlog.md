# Backlog ứng dụng — Lê Ngọc Anh, Ngô Quang Tiến, Võ Trung Tín

Tài liệu này liệt kê **việc còn lại về logic code / API / test / demo** sau khi rà soát codebase (2026-06-11).  
**Nguồn chính trạng thái tính năng:** [features.md](../features.md). **Infra/DevOps:** [phan-phu-tho-infrastructure-backlog.md](./phan-phu-tho-infrastructure-backlog.md) (Phan Phú Thọ). **Admin Platform API (owner Võ Trung Tín, deadline sáng CN 14/06/2026):** [admin-backlog.md](./admin-backlog.md).

## Tóm tắt rà soát

| Kết luận | Chi tiết |
|----------|----------|
| **MVP API backend** | Luồng 7 bước demo **đã có endpoint** — [mvp-demo-scope.md](../mvp-demo-scope.md) |
| **Demo E2E script** | ✅ `scripts/demo-e2e.sh` + `scripts/demo-e2e.ps1` — 7 bước qua Traefik |
| **Activity feed task** | ✅ `GET /api/v1/tasks/:id/activity` (`get-task-activity.handler.ts`) |
| **Không có `TODO`/`FIXME`** trong `services/**` | Gap chủ yếu: e2e per service, OpenAPI 5/5, contract test, workspace activity |
| **Thiếu lớn nhất (app)** | E2E workspace/task/notification; CI smoke; OpenAPI; contract test tự động |
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
P0  Gắn demo-e2e vào CI smoke              →  Phú Thọ + Tín
P1  E2E per service (workspace/task/notif) →  Tiến + Tín
P1  Workspace activity feed                →  gap product (Tín)
P1  OpenAPI workspace + notification        →  ✅ Done (5/5 tại `/swagger`)
P1  Contract test (Pact / event schema)     →  cross-team
P2  Tech debt (Kafka dead code, console.log, mock paths) →  theo service
```

### P0 — Demo E2E (phối hợp 3 dev) — ✅ script Done

| # | Việc | Trạng thái | Owner |
|---|------|------------|-------|
| 1 | `scripts/demo-e2e.sh` + `scripts/demo-e2e.ps1` — 7 bước [mvp-demo-scope](../mvp-demo-scope.md) | ✅ | Võ Trung Tín |
| 2 | Chạy qua **Traefik** (`http://localhost/api/v1/...`) | ✅ | Võ Trung Tín |
| 3 | Tích hợp seed (`scripts/seed.sh`, `demo-seed-data.json`) | ✅ | Võ Trung Tín |
| 4 | Exit code ≠ 0 nếu bước fail; in `X-Request-Id` khi debug | ✅ | Võ Trung Tín |
| 5 | Gắn script vào **CI smoke** | [ ] | Phan Phú Thọ |

**Definition of Done (còn lại):** CI chạy `demo-e2e` trên Docker Compose + Traefik profile mỗi PR/nightly.

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

- [x] **Unit test use-case user-service** — **12/12** use case có spec (`services/user-service/src/application/use-cases/*.use-case.spec.ts` + `testing/user-profile-repository.mock.ts`)
- [x] **auth `IdentityService`** — `services/auth-service/src/modules/identity/identity.service.spec.ts`
- [x] **E2E** — `register → login → me` flow trong `auth-service/test/app.e2e-spec.ts`; user e2e ổn định in-memory (`delete DATABASE_URL` trong test); internal replicas e2e
- [x] **Internal replica API** — `internal-users.controller.spec.ts` + e2e `POST /api/v1/users/internal/replicas`
- [x] **RabbitMQ consumer** `auth-events` — `auth-events.controller.spec.ts`

#### P2 — OpenAPI & polish

- [x] Swagger **decorator** — `@ApiTags` / `@ApiOperation` / `@ApiBearerAuth` trên auth + user controllers; `@ApiProperty` trên DTO chính; internal API + `X-Internal-Service-Token` trong user Swagger
- [x] Document flow OTP / resend cooldown — mô tả trong `auth-service` Swagger (`app.controller.ts` + `main.ts`)

#### Out of scope MVP (ghi nhận, không ưu tiên)

- Quên mật khẩu / reset password public API
- Quản trị role/permission qua HTTP

**DoD giai đoạn Anh:** ✅ 12/12 user use cases có unit test; auth identity có spec riêng; e2e auth register→login→me pass; user e2e + internal replicas pass (in-memory).

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
- [x] **Hỗ trợ Tín:** contract internal membership dùng trong `scripts/demo-e2e` bước 2–4

#### P2 — OpenAPI & mở rộng (Planned)

- [x] **Swagger** — `workspace-service/src/main.ts` → `/swagger`
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
- **Activity feed task-level** — `GET /api/v1/tasks/:id/activity` (`get-task-activity.handler.ts`)
- **Demo E2E script** — `scripts/demo-e2e.sh` + `.ps1`

### Việc còn lại

#### P1 — Tính năng Planned

- [x] **Activity feed task-level** — `GET /api/v1/tasks/:taskId/activity` (events + comments, `limit`/`offset`)
- [ ] **Activity feed workspace-level** — `GET /api/v1/workspaces/:id/activity` (aggregate gần đây — chưa có route)

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
- [x] **Swagger notification-service** — `/swagger` + `@ApiTags` trên `notifications.controller.ts`
- [x] **Swagger task** — `/swagger` + `@ApiTags` task/comment/health; `@ApiProperty` trên request DTOs
- [ ] Thay `console.log` bằng `Logger` (có `requestId` khi Phase C+ structured log):
  - `task-service/src/main.ts`, RMQ listeners
  - `notification-service` comment listener
- [ ] **Attachment Azure** — document rõ mock vs prod trong `task-service/CLAUDE.md` / `.env.example`

#### Out of scope MVP

- WebSocket push notification
- HTTP archive notification (domain `Notification.archive()` chưa expose route)

**DoD giai đoạn Tín (còn lại):** board + mark-all-read có unit test; e2e task + notification; notification bỏ kafka-node; workspace activity feed (tuỳ product).

---

## Ma trận theo service (tham chiếu nhanh)

| Service | Logic MVP | Gap chính | Owner |
|---------|-----------|-----------|--------|
| auth-service | Done | — (identity spec + Swagger + e2e flow ✅) | Anh |
| user-service | Done | — (12/12 use-case specs + internal/auth-events tests ✅) | Anh |
| workspace-service | Done | E2E, Swagger, outbox test | Tiến |
| task-service | Done | Board test, e2e, workspace mock guard, workspace activity | Tín (+ Tiến integration) |
| notification-service | Done | mark-all test, e2e, Kafka cleanup, Swagger | Tín |

---

## Cross-cutting (chia hoặc pair programming)

| Hạng mục | Ghi chú | Gợi ý owner |
|----------|---------|-------------|
| **Contract test tự động** | Pact hoặc schema test event JSON; hiện chỉ doc + `@collabspace/shared` | Cả team |
| **CI smoke `demo-e2e`** | Script Done; chưa gate PR | Phú Thọ + Tín |
| Structured logging + `requestId` trong log line | Phase C middleware có; chưa inject mọi log line; gRPC chưa propagate | Tín + Anh |
| OpenAPI 5/5 services | ✅ Tất cả tại `/swagger` — xem [README.md](../../README.md#openapi-swagger-ui) | — |
| Chuẩn hóa API prefix | task/notification: `api` + `v1/...` controller vs `api/v1` global ở auth/user/workspace | Cả team (breaking nếu đổi) |
| Contract sync sau đổi API | `service-contracts.md`, `api-routes.md` | Người mở PR |
| `pnpm` workspace root | `package.json` + `packages/shared` — build/test từ root | Phú Thọ (CI) |
| `scripts/load-demo-seed-data` build artifacts | `.js/.d.ts` gitignored — chạy từ `.ts` hoặc commit policy | Tín + Phú Thọ (CI) |

---

## Checklist sprint (copy)

| # | Việc | Owner | P |
|---|------|-------|---|
| 1 | `scripts/demo-e2e` sh + ps1 | Tín | P0 ✅ |
| 2 | E2E qua Traefik | Tín | P0 ✅ |
| 3 | Activity feed `GET .../tasks/:id/activity` | Tín | P1 ✅ |
| 3b | Workspace activity `GET .../workspaces/:id/activity` | Tín | P1 |
| 15 | Gắn `demo-e2e` CI smoke | Phú Thọ | P0 |
| 4 | User use-case tests (batch 1: create/update/bulk) | Anh | P1 ✅ |
| 5 | User use-case tests (batch 2: preferences/status) | Anh | P1 ✅ |
| 6 | auth IdentityService spec | Anh | P1 ✅ |
| 7 | workspace e2e spec | Tiến | P1 |
| 8 | workspace Swagger | Tiến | P2 ✅ |
| 9 | WORKSPACE_CLIENT_MODE=http enforce prod | Tiến | P1 |
| 10 | get-task-board unit test | Tín | P1 |
| 11 | mark-all-read unit test | Tín | P1 |
| 12 | notification e2e spec | Tín | P1 |
| 13 | Remove kafka-node dead code | Tín | P2 |
| 14 | notification Swagger | Tín | P2 ✅ |

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

*Cập nhật: 2026-06-11 — sync doc với codebase: demo-e2e Done, task activity feed Done, ưu tiên e2e per service + CI + contract test. Đóng backlog **Lê Ngọc Anh** (user tests, identity spec, e2e, Swagger).*

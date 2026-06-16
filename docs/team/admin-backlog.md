# Backlog Admin Platform API

Tài liệu chốt **phạm vi backend** cho Admin UI (team đã có frontend riêng).  
**Không** tạo `admin-service` mới — mở rộng 4 service hiện tại + guard dùng chung.

**Nguồn spec:** đề xuất API admin (Auth / User / Workspace / Notification), chỉnh theo codebase CollabSpace (2026-06-12).  
**Deadline:** **sáng Chủ nhật 14/06/2026** ✅  
**Trạng thái tính năng:** [features.md](../features.md) § Platform Administration. **Backlog MVP chung:** [application-backlog.md](./application-backlog.md).

---

## Tóm tắt

| Kết luận | Chi tiết |
|----------|----------|
| **Backend admin HTTP** | ✅ **Done** — A1–A7, AUTH-1→12, USER-1/2, WS-1→3, NOTIF-1, USER-T1 |
| **Shared guard** | ✅ `@collabspace/nest-auth` — `PlatformAdminGuard`, `@RequirePlatformAdmin()`, `@RequirePermission()`, `@AdminUserId()` |
| Admin UI handoff | Backend sẵn sàng — checklist § Đồng bộ Admin UI chờ team UI |
| Workspace membership | `owner`, `manager` (**Planned**), `member` — tách khỏi platform `admin`; xem [roles-and-permissions.md](../roles-and-permissions.md) |

**Implementation refs:** `packages/nest-auth`, `auth-admin.controller.ts`, `users-admin.controller.ts`, `workspace-admin.controller.ts`, `notification-admin.controller.ts`, `BroadcastJobService`, event `workspace_deleted`.

### Phân công

| Owner | Phạm vi |
|-------|--------|
| **Võ Trung Tín** | Toàn bộ backlog admin ✅ |

---

## Nền tảng chung

| # | Việc | Priority | Trạng thái |
|---|------|----------|------------|
| A1 | `PlatformAdminGuard` + `isPlatformAdmin()` / `auth.manage` | P0 | [x] |
| A2 | Package `@collabspace/nest-auth` — guard + `@RequirePermission()` + `@RequirePlatformAdmin()` | P0 | [x] |
| A3 | Convention `/api/v1/{service}/admin/*` | P0 | [x] |
| A4 | Gateway prefix + defense-in-depth ở service | P1 | [x] |
| A5 | Structured audit log (`admin_action=...`) | P1 | [x] |
| A6 | Ban / đổi role → revoke refresh token | P1 | [x] |
| A7 | [api-routes.md](../api-routes.md) + [service-contracts.md](../../.claude/docs/service-contracts.md) | P1 | [x] |

---

## Auth Service — AUTH-1 → AUTH-12

**Controller:** `services/auth-service/src/presentation/http/auth-admin.controller.ts`

| # | Method | Path | Trạng thái |
|---|--------|------|------------|
| AUTH-1 → AUTH-8 | (Phase 1 P0) | `/api/v1/auth/admin/*` | [x] |
| AUTH-9 → AUTH-10 | PUT/DELETE roles | | [x] |
| AUTH-11 | Migration `last_login_at` + `recordLogin` on login | | [x] |
| AUTH-12 | `lastLoginAt` in `GET /auth/admin/users` | | [x] |

### Test & docs (Auth)

- [x] Unit test — `manage-auth-admin.use-case.spec.ts` (CRUD delegate + session revoke)
- [x] E2E — member `403` / admin `201` on `POST /auth/admin/roles`
- [x] E2E — ban via `active-status` → login `403 USER_INACTIVE`
- [x] Swagger `@ApiTags('auth-admin')`

---

## User Service — USER-1, USER-2, USER-T1

| # | Method | Path | Trạng thái |
|---|--------|------|------------|
| USER-1 | `GET` | `/api/v1/users/admin/all` | [x] |
| USER-2 | `DELETE` | `/api/v1/users/admin/:id` | [x] |
| USER-T1 | `GET /users`, `/users/search` | Non-admin **bắt buộc** `q`; full list qua admin API | [x] |

### Test & docs (User)

- [x] Unit test — `manage-users-admin.use-case.spec.ts`
- [x] HTTP spec — `users-admin.controller.spec.ts` member `403` / admin `200`
- [x] Unit spec — `users.controller.spec.ts` (`DIRECTORY_QUERY_REQUIRED`)
- [x] Swagger `@ApiTags('users-admin')`

---

## Workspace Service — WS-1 → WS-3

| # | Method | Path | Trạng thái |
|---|--------|------|------------|
| WS-1 | `GET` | `/api/v1/workspaces/admin/all` | [x] |
| WS-2 | `DELETE` | `/api/v1/workspaces/admin/:id` | [x] |
| WS-3 | `POST` | `/api/v1/workspaces/admin/:id/force-join` | [x] |

**Task coordination:** `workspace_deleted` → `task-service` cleanup ✅

### Test & docs (Workspace)

- [x] Unit test — `manage-workspaces-admin.use-case.spec.ts`
- [x] HTTP spec — `workspace-admin.controller.spec.ts` admin vs member
- [x] Swagger `@ApiTags('workspaces-admin')`

---

## Notification Service — NOTIF-1

| # | Method | Path | Trạng thái |
|---|--------|------|------------|
| NOTIF-1 | `POST` | `/api/v1/notifications/admin/broadcast` | [x] |

Fan-out: `BroadcastJobService` (persisted jobs, batch 100, recipient dedupe, `Idempotency-Key`).

### Test & docs (Notification)

- [x] Unit test controller — `notification-admin.controller.spec.ts`
- [x] Integration — `broadcast-job.service.spec.ts` (job → `createBroadcastAsync` per recipient)
- [x] Swagger `@ApiTags('notifications-admin')`

---

## Bảng endpoint (contract chốt)

| Service | Method | Path | Trạng thái |
|---------|--------|------|------------|
| auth | `POST` | `/api/v1/auth/admin/roles` | [x] |
| auth | `POST` | `/api/v1/auth/admin/permissions` | [x] |
| auth | `POST` | `/api/v1/auth/admin/roles/:roleId/permissions` | [x] |
| auth | `DELETE` | `/api/v1/auth/admin/roles/:roleId/permissions/:permissionId` | [x] |
| auth | `POST` | `/api/v1/auth/admin/users/:userId/roles` | [x] |
| auth | `GET` | `/api/v1/auth/admin/roles` | [x] |
| auth | `GET` | `/api/v1/auth/admin/permissions` | [x] |
| auth | `PUT` | `/api/v1/auth/admin/roles/:id` | [x] |
| auth | `DELETE` | `/api/v1/auth/admin/roles/:id` | [x] |
| auth | `GET` | `/api/v1/auth/admin/users` | [x] |
| auth | `PATCH` | `/api/v1/auth/admin/users/:id/active-status` | [x] |
| user | `GET` | `/api/v1/users/admin/all` | [x] |
| user | `DELETE` | `/api/v1/users/admin/:id` | [x] |
| workspace | `GET` | `/api/v1/workspaces/admin/all` | [x] |
| workspace | `DELETE` | `/api/v1/workspaces/admin/:id` | [x] |
| workspace | `POST` | `/api/v1/workspaces/admin/:id/force-join` | [x] |
| notification | `POST` | `/api/v1/notifications/admin/broadcast` | [x] |

---

## Đồng bộ Admin UI (chờ team frontend)

| # | Việc | Trạng thái |
|---|------|------------|
| 1 | UI gửi danh sách endpoint / OpenAPI client | [ ] |
| 2 | Đối chiếu path `/admin/*` với bảng trên | [ ] |
| 3 | Dùng `GET /users/admin/all` (aggregate backend) | [x] backend ready |
| 4 | Error codes: `403` + `PLATFORM_ADMIN_REQUIRED`, `DIRECTORY_QUERY_REQUIRED`, validation | [x] backend ready |

**OpenAPI tags:** `auth-admin`, `users-admin`, `workspaces-admin`, `notifications-admin` — `/swagger` từng service.

---

## Out of scope (giữ nguyên)

| Hạng mục | Lý do |
|----------|--------|
| `admin-service` / BFF | Guard + route per service đủ MVP |
| Admin UI repo | Team riêng |
| `phone` column | Chưa có schema |
| Audit log DB | MVP: structured log only |
| Hard delete | GDPR soft delete + anonymize |
| `force-join` role | Luôn `member` trên workspace (platform admin điều tra, không thay owner) |

---

## Tài liệu liên quan

| Tài liệu | Mục đích |
|----------|----------|
| [features.md](../features.md) | § Platform Administration |
| [roles-and-permissions.md](../roles-and-permissions.md) | Platform vs workspace roles |
| [application-backlog.md](./application-backlog.md) | Backlog MVP end-user |
| [api-routes.md](../api-routes.md) | Route HTTP + admin |
| [service-contracts.md](../../.claude/docs/service-contracts.md) | Hợp đồng chính thức |

---

*Cập nhật: 2026-06-13 — hoàn tất backlog backend admin: `@collabspace/nest-auth`, tests, USER-T1 directory guard.*

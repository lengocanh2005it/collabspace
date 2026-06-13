# Backlog Admin Platform API

Tài liệu chốt **phạm vi backend** cho Admin UI (team đã có frontend riêng).  
**Không** tạo `admin-service` mới — mở rộng 4 service hiện tại + guard dùng chung.

**Nguồn spec:** đề xuất API admin (Auth / User / Workspace / Notification), chỉnh theo codebase CollabSpace (2026-06-12).  
**Deadline:** **sáng Chủ nhật 14/06/2026** (trước buổi họp / handoff Admin UI).  
**Trạng thái tính năng end-user:** [features.md](../features.md). **Backlog MVP chung:** [application-backlog.md](./application-backlog.md).

---

## Tóm tắt

| Kết luận | Chi tiết |
|----------|----------|
| Admin UI | Team đã có — repo riêng; cần **khớp contract** với bảng API bên dưới |
| Backend admin HTTP | **Chưa có** — schema role/permission + `is_active` có sẵn ở `auth-service` |
| Kiến trúc | Route `/api/v1/{service}/admin/*` trên từng service; `AdminGuard` shared (`packages/nest-auth` hoặc mở rộng `packages/shared`) |
| Workspace `admin` | Role **trong workspace** (owner/admin/member) — **khác** platform admin ở tài liệu này |

### Phân công

| Owner | Phạm vi |
|-------|--------|
| **Võ Trung Tín** | Toàn bộ backlog admin — 5 service (`auth`, `user`, `workspace`, `task` coordination, `notification`) + shared `AdminGuard` + docs contract · **deadline sáng CN 14/06/2026** |

> Infra Traefik/gateway (A4): Tín implement phía app/guard; cấu hình gateway phối hợp Phan Phú Thọ nếu cần.

---

## Nền tảng chung

Làm **trước** mọi endpoint admin.

| # | Việc | Priority | Owner | Trạng thái |
|---|------|----------|-------|------------|
| A1 | `AdminGuard` — check platform role `admin` (hoặc permission) sau `AuthGuard` | P0 | Tín | [ ] |
| A2 | Package `@collabspace/nest-auth` (hoặc mở rộng `@collabspace/shared`) — guard + decorator `@RequirePermission()` | P0 | Tín | [ ] |
| A3 | Convention URL: `/api/v1/{service}/admin/*` — không trộn route user thường | P0 | Tín | [ ] |
| A4 | Traefik: route `*/admin/*` qua gateway; defense-in-depth ở service | P1 | Tín | [ ] |
| A5 | Audit log structured cho thao tác admin (ban, role, force-delete, force-join, broadcast) | P1 | Tín | [ ] |
| A6 | Sau `ban` / đổi role → revoke refresh token (`auth-service`) | P1 | Tín | [ ] |
| A7 | Cập nhật [api-routes.md](../api-routes.md) + [service-contracts.md](../../.claude/docs/service-contracts.md) khi merge API | P1 | Tín | [ ] |

**Definition of Done (nền tảng):** User không có role `admin` gọi bất kỳ `/admin/*` → `403`; user `admin` (seed `tho@collabspace.dev`) gọi được Phase 1 endpoints.

---

## Ưu tiên theo phase (deadline sáng CN 14/06)

```text
Bắt buộc trước deadline   Phase 1 — AdminGuard + Auth admin + User admin list
Nên có nếu kịp          Phase 2 — Workspace admin + User GDPR delete
Có thể slip sau CN      Phase 3 — Broadcast + last_login migration + audit đầy đủ
```

| Phase | Mục tiêu | Deadline |
|-------|----------|----------|
| **Phase 1** (P0) | A1–A3, AUTH-1→8, USER-1 — Admin UI chạy được list user / role / ban | **CN 14/06 sáng** |
| **Phase 2** (P1) | WS-1→3, USER-2 | Nên xong CN sáng; chấp nhận slip tối CN nếu Phase 1 ổn |
| **Phase 3** (P2) | NOTIF-1, AUTH-11→12, A5 audit DB | Sau handoff CN nếu thiếu giờ |

---

## Auth Service — Phân quyền & tài khoản

**Service:** `services/auth-service`  
**Owner:** Võ Trung Tín

> Ghi chú codebase: bảng `roles`, `permissions`, `user_roles` và seed role `admin` / `member` / `viewer` **đã có**. HTTP API quản trị **chưa expose** — implement mới kèm `AdminGuard`, không phải chỉ “khóa route public”.

### Phase 1 — P0

| # | Method | Path | Mô tả | Trạng thái |
|---|--------|------|--------|------------|
| AUTH-1 | `POST` | `/api/v1/auth/admin/roles` | Tạo role hệ thống | [ ] |
| AUTH-2 | `POST` | `/api/v1/auth/admin/permissions` | Tạo permission | [ ] |
| AUTH-3 | `POST` | `/api/v1/auth/admin/roles/:roleId/permissions` | Gán permission cho role | [ ] |
| AUTH-4 | `POST` | `/api/v1/auth/admin/users/:userId/roles` | Gán / đổi role user | [ ] |
| AUTH-5 | `GET` | `/api/v1/auth/admin/roles` | Danh sách role (dashboard) | [ ] |
| AUTH-6 | `GET` | `/api/v1/auth/admin/permissions` | Danh sách permission | [ ] |
| AUTH-7 | `GET` | `/api/v1/auth/admin/users` | List user admin: `id`, `email`, `isActive`, `emailVerified`, `roles`, `createdAt` | [ ] |
| AUTH-8 | `PATCH` | `/api/v1/auth/admin/users/:id/active-status` | Khóa / mở tài khoản (`is_active`) | [ ] |

### Phase 1 — P1

| # | Method | Path | Mô tả | Trạng thái |
|---|--------|------|--------|------------|
| AUTH-9 | `PUT` | `/api/v1/auth/admin/roles/:id` | Sửa role (name, description) | [ ] |
| AUTH-10 | `DELETE` | `/api/v1/auth/admin/roles/:id` | Xóa role — không xóa role seed nếu còn user gán | [ ] |

### Phase 3 — P2

| # | Việc | Mô tả | Trạng thái |
|---|------|--------|------------|
| AUTH-11 | Migration `last_login_at` | Cột + cập nhật khi login thành công | [ ] |
| AUTH-12 | Bổ sung `lastLoginAt` vào `GET /auth/admin/users` | Sau AUTH-11 | [ ] |

### Test & docs (Auth)

- [ ] Unit test use-case / service cho CRUD role, gán role, `active-status`
- [ ] E2E: admin login → tạo role → gán user → user bị ban không login được
- [ ] Swagger `@ApiTags('auth-admin')` + `@ApiBearerAuth`

### Quy tắc nghiệp vụ

- Không xóa role seed `admin`, `member`, `viewer` khi còn `user_roles` tham chiếu
- `active-status: false` → chặn login (logic `USER_INACTIVE` trong `User.assertCanLogin()` / `TypeOrmUserRepository`)
- Đổi role / ban → revoke refresh token (A6)

---

## User Service — Quản lý profile

**Service:** `services/user-service`  
**Owner:** Võ Trung Tín

> **Ban / email / `is_active`** thuộc `auth-service` (AUTH-8), không duplicate ở user-service.  
> Field `phone` **chưa có** schema — **out of scope** phase 1–2 trừ khi thêm migration riêng.

### Phase 1 — P0

| # | Method | Path | Mô tả | Trạng thái |
|---|--------|------|--------|------------|
| USER-1 | `GET` | `/api/v1/users/admin/all` | Toàn bộ user: profile (`fullName`, `username`, `displayName`, …) + hydrate từ auth (`email`, `isActive`, `roles`, `createdAt`, `lastLoginAt`*) | [ ] |

\* `lastLoginAt` phụ thuộc AUTH-11.

**Implementation gợi ý:** user-service gọi auth qua gRPC hoặc internal HTTP để aggregate; hoặc Admin UI gọi 2 API — **chốt một cách** với team frontend.

### Phase 2 — P1

| # | Method | Path | Mô tả | Trạng thái |
|---|--------|------|--------|------------|
| USER-2 | `DELETE` | `/api/v1/users/admin/:id` | GDPR: soft delete + anonymize profile; phối hợp xóa/anonymize auth user | [ ] |

### Tech debt liên quan (không thuộc admin mới)

| # | Việc | Ghi chú | Trạng thái |
|---|------|---------|------------|
| USER-T1 | Rà soát `GET /api/v1/users` | Mọi user login hiện list directory — cân nhắc giới hạn nếu admin list đủ dùng | [ ] |

### Test & docs (User)

- [ ] Unit test aggregate admin list (mock auth client)
- [ ] E2E / integration: admin `GET /users/admin/all` → 403 với member, 200 với admin
- [ ] Swagger `@ApiTags('users-admin')`

---

## Workspace Service — Super Admin

**Service:** `services/workspace-service`  
**Owner:** Võ Trung Tín

> Khác **workspace RBAC** hiện có (`owner` / `admin` / `member` trong từng workspace). Nhóm API dưới đây là **platform admin override**.

### Phase 2 — P1

| # | Method | Path | Mô tả | Trạng thái |
|---|--------|------|--------|------------|
| WS-1 | `GET` | `/api/v1/workspaces/admin/all` | List tất cả workspace: id, name, owner, member count, `createdAt`, … | [ ] |
| WS-2 | `DELETE` | `/api/v1/workspaces/admin/:id` | Force xóa workspace vi phạm — soft delete + cascade members/projects | [ ] |
| WS-3 | `POST` | `/api/v1/workspaces/admin/:id/force-join` | Admin thêm mình vào workspace điều tra — body có `reason` | [ ] |

### Quy tắc nghiệp vụ

- `force-join`: role tạm `admin` hoặc `observer` (chốt với product); **bắt buộc** audit log + `reason`
- `DELETE` workspace: coordination với `task-service` (task theo `workspaceId`) — saga hoặc event `workspace_deleted`
- Hiện **chưa có** `DELETE /workspaces/:id` cho user thường — chỉ có xóa project

### Test & docs (Workspace)

- [ ] Unit test use-case admin list / force-delete / force-join
- [ ] E2E admin vs member permission
- [ ] Swagger + cập nhật contract internal nếu cascade sang task

---

## Notification Service — Broadcast

**Service:** `services/notification-service`  
**Owner:** Võ Trung Tín

### Phase 3 — P1

| # | Method | Path | Mô tả | Trạng thái |
|---|--------|------|--------|------------|
| NOTIF-1 | `POST` | `/api/v1/notifications/admin/broadcast` | Thông báo hệ thống (maintenance, feature update) | [ ] |

**Body gợi ý:**

```json
{
  "title": "Scheduled maintenance",
  "body": "System will be down at ...",
  "target": "all",
  "type": "system_broadcast"
}
```

### Yêu cầu kỹ thuật

- `type: system_broadcast` tách khỏi notification nghiệp vụ (`task_assigned`, …)
- Fan-out qua job queue — không insert đồng bộ hàng loạt
- `Idempotency-Key` tránh gửi trùng
- `target` phase 1: `all`; mở rộng sau: `role:admin`, …

### Test & docs (Notification)

- [ ] Unit test handler broadcast + idempotency
- [ ] Integration: admin broadcast → user thấy notification khi `GET /notifications`
- [ ] Swagger

---

## Out of scope

| Hạng mục | Lý do |
|----------|--------|
| `admin-service` / BFF riêng | API theo bounded context; guard shared đủ cho MVP admin |
| Admin UI | Team đã có repo riêng |
| `phone` trên admin user list | Chưa có column — phase sau nếu product cần |
| Audit log DB / compliance đầy đủ | MVP: structured log; bảng audit phase sau ([nfrs.md](../nfrs.md)) |
| Hard delete user/workspace | GDPR dùng soft delete + anonymize |

---

## Đồng bộ Admin UI

Checklist khi ghép frontend:

- [ ] UI team gửi danh sách endpoint đang gọi (hoặc OpenAPI client)
- [ ] Đối chiếu path với bảng trên — ưu tiên prefix `/admin/*`
- [ ] Chốt aggregate `GET /users/admin/all` vs UI gọi auth + user riêng
- [ ] Error codes thống nhất: `403 FORBIDDEN` (không phải admin), `404`, validation

---

## Bảng tổng hợp endpoint (contract chốt)

| Service | Method | Path |
|---------|--------|------|
| auth | `POST` | `/api/v1/auth/admin/roles` |
| auth | `POST` | `/api/v1/auth/admin/permissions` |
| auth | `POST` | `/api/v1/auth/admin/roles/:roleId/permissions` |
| auth | `POST` | `/api/v1/auth/admin/users/:userId/roles` |
| auth | `GET` | `/api/v1/auth/admin/roles` |
| auth | `GET` | `/api/v1/auth/admin/permissions` |
| auth | `PUT` | `/api/v1/auth/admin/roles/:id` |
| auth | `DELETE` | `/api/v1/auth/admin/roles/:id` |
| auth | `GET` | `/api/v1/auth/admin/users` |
| auth | `PATCH` | `/api/v1/auth/admin/users/:id/active-status` |
| user | `GET` | `/api/v1/users/admin/all` |
| user | `DELETE` | `/api/v1/users/admin/:id` |
| workspace | `GET` | `/api/v1/workspaces/admin/all` |
| workspace | `DELETE` | `/api/v1/workspaces/admin/:id` |
| workspace | `POST` | `/api/v1/workspaces/admin/:id/force-join` |
| notification | `POST` | `/api/v1/notifications/admin/broadcast` |

---

## Tài liệu liên quan

| Tài liệu | Mục đích |
|----------|----------|
| [features.md](../features.md) | Trạng thái tính năng end-user |
| [application-backlog.md](./application-backlog.md) | Backlog MVP (không trùng — bổ sung admin) |
| [api-routes.md](../api-routes.md) | Chỉ mục route HTTP |
| [service-contracts.md](../../.claude/docs/service-contracts.md) | Hợp đồng chính thức |
| [production-hardening.md](../production-hardening.md) | Gateway, internal route, metrics |

---

*Cập nhật: 2026-06-12 — owner **Võ Trung Tín**; deadline **sáng Chủ nhật 14/06/2026**.*

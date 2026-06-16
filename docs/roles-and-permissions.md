# Vai trò & phân quyền CollabSpace

CollabSpace dùng **hai lớp role độc lập**. Mỗi tài khoản có **đúng một platform role**; trong từng workspace họ tham gia lại có **một workspace role riêng**.

**Liên quan:** [features.md](./features.md) · [api-routes.md](./api-routes.md) · [service-contracts.md](../.claude/docs/service-contracts.md)

---

## Tổng quan: 5 role trên 2 lớp

Hệ thống có **5 role** (không tính permission chi tiết bên dưới):

| Lớp | Service | Số role | Tên role |
|-----|---------|---------|----------|
| **Platform** | `auth-service` | **2** | `admin`, `user` |
| **Workspace** | `workspace-service` | **3** | `owner`, `manager`, `member` |

```
┌──────────────────── PLATFORM (auth-service) ────────────────────┐
│                                                                  │
│   admin                          user                            │
│   ─────                          ────                            │
│   Vận hành hệ thống              Người dùng thông thường         │
│   (/admin, ban user, …)          (đăng ký, collaboration)        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
         │                                    │
         │  JWT: role / roles / permissions   │
         ▼                                    ▼
┌────────────────── WORKSPACE (workspace-service) ────────────────┐
│                                                                  │
│   owner              manager              member                 │
│   ─────              ───────              ──────                 │
│   Chủ workspace      Quản lý vận hành     Thành viên             │
│   (người tạo)        (do owner bổ nhiệm)  (mặc định khi accept)  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Quy tắc vàng

1. **Hai lớp hoàn toàn độc lập.** Platform `admin` **không** tự động là workspace `owner`. Platform `user` **không** tự động là workspace `member` cho đến khi được mời hoặc tự tạo workspace.
2. **Platform `user` ≠ “chưa có workspace”.** `user` là role mặc định của mọi tài khoản đăng ký — kể cả khi họ đã owner nhiều workspace. Trạng thái “mới đăng ký, chưa tạo/join workspace” là **empty state UI**, không phải một role riêng.
3. **Workspace `member` ≠ platform `user`.** Cùng chữ “member/user” nhưng khác lớp: workspace `member` chỉ có hiệu lực **trong một workspace**; platform `user` áp dụng **toàn hệ thống**.
4. **Quyền collaboration thực tế** = platform permissions (từ role `user`) **cộng với** workspace role trong ngữ cảnh workspace đó.

---

## Platform roles (`auth-service`)

- **Lưu trữ:** bảng `roles`, `user_roles`, `role_permissions` (PostgreSQL).
- **Phát hành:** JWT access token — claim `role`, `roles`, `permissions`; gateway forward qua header `X-Role`, `X-Roles`, `X-Permissions`.
- **Đăng ký mới:** tự gán role **`user`** (sau khi verify email và login).
- **Kiểm tra admin:** `isPlatformAdmin()` — role `admin` hoặc permission `auth.manage`.

### Ma trận nhanh — platform

| Hành động / quyền | `admin` | `user` |
|-------------------|:-------:|:------:|
| Đăng nhập, xem/sửa profile cá nhân | ✅ | ✅ |
| Tạo workspace | ❌* | ✅ |
| Nhận & accept invitation | ❌* | ✅ |
| Collaboration UI (`/workspaces`, dashboard, kanban, …) | ❌* | ✅ |
| Search user directory (cần query) | ✅ | ✅ |
| Browse toàn bộ user không query | ✅ | ❌ |
| Truy cập `/admin` và API `auth/admin/*` | ✅ | ❌ |
| Ban/unban user, force-delete workspace | ✅ | ❌ |
| Gán platform role cho user khác | ✅ | ❌ |
| Broadcast notification toàn hệ thống | ✅ | ❌ |

\* Platform `admin` bị **cố ý tách** khỏi luồng collaboration thông thường (FE redirect về `/admin`). BE vẫn có API force-join nhưng UI workspace chưa hỗ trợ admin tham gia workspace.

---

### `admin` — Quản trị viên nền tảng

**Là ai:** Người vận hành hệ thống (DevOps, platform operator). Không phải “chủ công ty” hay “owner workspace” — đó là workspace role.

**Mục đích:** Quản lý tài khoản, workspace, RBAC và vận hành mà **không** lẫn vào nội dung collaboration hàng ngày.

**Làm được:**

| Nhóm | Chi tiết |
|------|----------|
| **Admin panel** | Truy cập `/admin` — quản lý user, workspace, role, permission |
| **Tài khoản** | Ban / unban (`isActive`); xóa user (GDPR anonymize qua user-service admin) |
| **Workspace** | Xem danh sách tất cả workspace; force-delete workspace |
| **RBAC** | Tạo role/permission; gán / thu hồi role cho user (`POST /auth/admin/users/:id/roles`) |
| **Directory** | Liệt kê user không cần search query (không bị `403 DIRECTORY_QUERY_REQUIRED`) |
| **Điều tra** | `POST /workspaces/admin/:id/force-join` — thêm admin vào workspace với workspace role `member` (S2S / admin API) |
| **Thông báo** | Broadcast notification toàn hệ thống |

**KHÔNG làm được (thiết kế có chủ ý):**

- Tạo workspace qua UI collaboration
- Duyệt `/workspaces`, `/dashboard`, `/invitations`, `/workspaces/:id` — FE `CollaborationRoute` redirect về `/admin`
- Accept invitation qua UI
- Xem kanban / task như user thông thường (trừ khi có force-join và FE mở sau này)

**Permissions (seed):** tất cả — `auth.manage`, `users.read`, `users.write`, `workspaces.read`, `workspaces.write`, `tasks.read`, `tasks.write`, `notifications.read`.

**Giao diện:** Sau login → `/admin`. Sidebar: Platform Admin, Notifications. Không có workspace switcher.

---

### `user` — Người dùng nền tảng

**Là ai:** **Mọi** tài khoản đăng ký bình thường — từ người mới chưa có workspace đến owner nhiều workspace.

**Mục đích:** Tham gia collaboration: tạo workspace, nhận invite, làm việc với project/task theo **workspace role** của họ.

**Trạng thái điển hình:**

| Trạng thái | Platform role | Workspace membership | Giao diện |
|------------|---------------|----------------------|-----------|
| Mới đăng ký | `user` | *(chưa có)* | Empty state — gợi ý tạo workspace hoặc chờ invite |
| Đã tạo workspace | `user` | `owner` ở workspace đó | Full collaboration |
| Được mời | `user` | Sau accept → `member` | Full collaboration trong workspace |
| Owner + member nhiều nơi | `user` | `owner` / `manager` / `member` tùy workspace | Workspace switcher |

**Làm được:**

| Nhóm | Chi tiết |
|------|----------|
| **Tài khoản** | Login, logout, đổi mật khẩu, quản lý session |
| **Profile** | Xem/sửa profile, avatar, preferences (`user-service`) |
| **Workspace** | Tạo workspace (trở thành workspace `owner`); xem/sửa workspace theo workspace role |
| **Invitation** | Xem invitation của mình; accept / reject |
| **Directory** | Tìm user **có search query** (mention, assignee) |
| **Task & comment** | Theo workspace role — xem chi tiết bảng workspace bên dưới |
| **Notification** | Xem và đánh dấu đã đọc notification của mình |

**KHÔNG làm được:**

- Truy cập `/admin` hoặc API admin (`403` qua `PlatformAdminGuard`)
- Browse toàn bộ user directory không có query (`403 DIRECTORY_QUERY_REQUIRED`)
- Hành động vượt workspace role (vd. `member` không tạo project dù platform là `user`)

**Permissions (seed):** `users.read`, `users.write`, `workspaces.read`, `workspaces.write`, `tasks.read`, `tasks.write`, `notifications.read`.

**Giao diện:** Dashboard, All Workspaces, Projects, Kanban, Notifications, Invitations.

> **Lịch sử:** Trước đây có thêm platform role `member` (trùng tên workspace) và `viewer` (read-only stakeholder). Đã gộp về **`user`** để đơn giản hóa MVP. Read-only nếu cần sau này nên xử lý ở **workspace role** hoặc feature riêng.

---

## Workspace roles (`workspace-service`)

- **Lưu trữ:** `workspace_members.role` (PostgreSQL).
- **Kiểm tra:** `WorkspaceRoleGuard`, `meetsWorkspaceRole()` từ `@collabspace/shared`; task/notification service gọi internal membership API + Service JWT.
- **Mặc định khi accept invite:** luôn là **`member`** — không invite thẳng lên `manager` / `owner`.

### Ma trận chi tiết — workspace

| Hành động | owner | manager | member |
|-----------|:-----:|:-------:|:------:|
| Xem workspace, members, activity | ✅ | ✅ | ✅ |
| Xem pending invitations (list) | ✅ | ✅ | ✅ |
| Tạo / sửa / xóa **project** | ✅ | ✅ | ❌ |
| Mời thành viên (email invite) | ✅ | ✅ | ❌ |
| Tạo / sửa / assign / comment **task** | ✅ | ✅ | ✅ |
| Sửa tên / mô tả workspace | ✅ | ❌ | ❌ |
| Xóa workspace | ✅ | ❌ | ❌ |
| Promote `member` → `manager` | ✅ | ❌ | ❌ |
| Demote `manager` → `member` | ✅ | ❌ | ❌ |
| Remove thành viên `member` | ✅ | ✅ | ❌ |
| Remove thành viên `manager` | ✅ | ❌ | ❌ |
| Remove `owner` | ❌ | ❌ | ❌ |
| Tự rời workspace (leave) | ❌* | ✅ | ✅ |

\* Owner không leave nếu chưa transfer ownership (ngoài phạm vi MVP).

---

### `owner` — Chủ sở hữu workspace

**Là ai:** Người **tạo** workspace (`POST /workspaces`). Mỗi workspace có **một** owner.

**Làm được:** Toàn quyền trong workspace — metadata, xóa workspace, quản lý thành viên (invite, promote, demote, remove), project CRUD, task CRUD.

**Không thể:** Tự rời workspace (chưa có transfer ownership).

---

### `manager` — Quản lý workspace

**Là ai:** Thành viên được **owner promote** từ `member` → `manager`.

**Làm được:** Vận hành hàng ngày — invite, remove `member`, project CRUD, task CRUD, leave workspace.

**Không thể:** Sửa metadata workspace, xóa workspace, promote/demote, remove `manager` / `owner`.

---

### `member` — Thành viên workspace

**Là ai:** User đã **accept invitation** hoặc được thêm khi tạo workspace (owner không có role `member` — họ là `owner`).

**Làm được:** Xem workspace; tham gia project; tạo/sửa/assign/comment task; leave workspace.

**Không thể:** Mời người khác; project CRUD; thay đổi role; remove ai.

---

## Kết hợp hai lớp — ví dụ thực tế

| User | Platform | Workspace A | Workspace B | Giải thích |
|------|----------|-------------|-------------|------------|
| Ngọc Anh | `user` | `owner` (Demo) | `member` (Product Lab) | Owner một nơi, member nơi khác — platform vẫn là `user` |
| Carol (PM) | `user` | `manager` (Demo) | `member` (Product Lab) | Manager do owner bổ nhiệm |
| Phú Thọ (ops) | `admin` | *(không dùng UI workspace)* | — | Chỉ vào `/admin` |
| Eve (pending) | `user` | *(chưa accept invite)* | — | Có invitation, chưa có membership |
| `viewer.only@` (cũ) | `user` | *(không có)* | — | Test empty state / `403` khi gọi API workspace không membership |

---

## Invitation flow

```
Owner / Manager gửi invite (email)
        │
        ▼
  Invitation lưu DB (email, workspaceId)
        │
        ▼
  Invitee nhận email + notification (nếu đã có tài khoản)
        │
        ▼
  Invitee (platform user) → /invitations → Accept
        │
        ▼
  workspace_members.role = member
```

**Lưu ý:**

- Invitee phải là platform **`user`** (hoặc admin dùng force-join — không qua invite UI).
- Accept **luôn** tạo workspace role `member`.
- Email invite **không** yêu cầu user đã tồn tại — invitation lưu email.

---

## Permissions (RBAC chi tiết — auth-service)

Platform role map sang permission strings trong JWT. Service downstream có thể kiểm tra permission hoặc chỉ dùng workspace membership.

| Permission | Mô tả | `admin` | `user` |
|------------|-------|:-------:|:------:|
| `auth.manage` | Quản trị RBAC, admin APIs | ✅ | ❌ |
| `users.read` | Đọc profile / directory | ✅ | ✅ |
| `users.write` | Sửa profile | ✅ | ✅ |
| `workspaces.read` | Đọc metadata workspace | ✅ | ✅ |
| `workspaces.write` | Tạo/sửa workspace (platform scope) | ✅ | ✅ |
| `tasks.read` | Đọc task (khi kiểm tra permission) | ✅ | ✅ |
| `tasks.write` | Ghi task | ✅ | ✅ |
| `notifications.read` | Đọc notification | ✅ | ✅ |

Workspace-level enforcement (project CRUD, invite, …) do **workspace-service** và **task-service** (`WorkspaceValidationGuard`) — không dùng platform permission `tasks.write` thay cho workspace role.

---

## Enforcement ở đâu?

| Kiểm tra | Vị trí | Cơ chế |
|----------|--------|--------|
| Platform admin | `PlatformAdminGuard` (`@collabspace/nest-auth`) | `admin` hoặc `auth.manage` |
| Admin user APIs | `user-service` `/users/admin/*` | `PlatformAdminGuard` |
| Admin workspace APIs | `workspace-service` `/workspaces/admin/*` | `PlatformAdminGuard` |
| Directory browse | `user-service` `GET /users` | Query bắt buộc trừ admin |
| Workspace project CRUD | `workspace-service` use cases | `owner` hoặc `manager` |
| Invite / remove member | `workspace-service` | `owner` / `manager` (remove chỉ `member` với manager) |
| Task APIs | `task-service` | JWT + workspace membership ≥ `member` |
| Collaboration UI (admin block) | Frontend `CollaborationRoute` | Redirect platform `admin` → `/admin` |

---

## Tài khoản demo (seed)

Password mặc định: `collabspace123`  
Nguồn: [`scripts/demo-seed-data.json`](../scripts/demo-seed-data.json)

| Email | Platform | Workspace & role | Dùng để test |
|-------|----------|------------------|--------------|
| `tho@collabspace.dev` | **admin** | Infra Ops owner* | `/admin/*`, ops |
| `trungtin@collabspace.dev` | **admin** | Infra Ops manager* | Admin panel |
| `ngocanh@collabspace.dev` | **user** | CollabSpace Demo (**owner**) | User A — full MVP flow |
| `quangtien@collabspace.dev` | **user** | Product Lab (**owner**) | User B — workspace thứ 2 |
| `pm.carol@collabspace.dev` | **user** | Demo (**manager**) | Manager permissions |
| `qa.alice@collabspace.dev` | **user** | Product Lab (**manager**) | Manager permissions |
| `dev.bob@collabspace.dev` | **user** | Demo (member) | Member flow |
| `dev.eve@collabspace.dev` | **user** | *(pending invite)* | Accept invitation |
| `viewer.only@collabspace.dev` | **user** | *(không có workspace)* | Empty state / 403 workspace APIs |
| `reviewer@collabspace.dev` | **user** | Demo (member) | Stakeholder đọc trong workspace |
| `solo.owner@collabspace.dev` | **user** | Solo Sandbox (**owner**) | Workspace một người |

\* Workspace membership của admin tồn tại trong seed data nhưng **UI collaboration chặn** platform admin — dùng tài khoản `user` để test workspace.

**Workspaces seed:** CollabSpace Demo · Product Lab · Infra Ops · Solo Sandbox

---

## Roadmap / ngoài phạm vi MVP

| Hạng mục | Trạng thái |
|----------|------------|
| Platform `admin` + `user` | **Done** (auth seed, JWT, guards) |
| Workspace `owner` / `manager` / `member` | **Done** |
| Transfer workspace ownership | Planned |
| Platform read-only stakeholder (`viewer` cũ) | **Removed** — dùng workspace role hoặc feature sau |
| FE admin force-join workspace | Open |

---

## Tài liệu liên quan

- [features.md](./features.md) — tính năng đã implement
- [api-routes.md](./api-routes.md) — endpoints
- [.claude/docs/service-contracts.md](../.claude/docs/service-contracts.md) — JWT, headers, gRPC, events
- [mvp-demo-scope.md](./mvp-demo-scope.md) — acceptance checklist

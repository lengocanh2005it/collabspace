# Vai trò & phân quyền CollabSpace

Tài liệu **nguồn chính** mô tả hai lớp role trong hệ thống: **platform** (toàn hệ thống) và **workspace** (trong một workspace). Đọc trước khi thêm API, guard, UI member management, hoặc seed data.

**Liên quan:** [features.md](./features.md) · [service-contracts.md](../.claude/docs/service-contracts.md) · [api-routes.md](./api-routes.md)

---

## Hai lớp role — không trộn lẫn

| Lớp | Lưu ở đâu | Giá trị | Ai gán |
|-----|-----------|---------|--------|
| **Platform** | `auth-service` — JWT `role` / `roles`, bảng `user_roles` | `admin`, `member`, `viewer` (+ permissions) | Platform admin qua `/api/v1/auth/admin/*` |
| **Workspace** | `workspace-service` — `workspace_members.role` | `owner`, `manager`, `member` | Owner promote/demote; accept invite luôn là `member` |

**Quy tắc vàng:** Platform role `admin` **không** tự động có quyền owner trong workspace. Muốn thao tác trong workspace phải là **member** (invite, accept, hoặc platform admin **force-join** với role `member`).

**Đã bỏ:** workspace role tên `admin` (dễ nhầm platform admin). Migration `DemoteWorkspaceAdminsToMember` chuyển dữ liệu cũ → `member`.

---

## Platform roles (`auth-service`)

Xác định qua `isPlatformAdmin()` = role `admin` **hoặc** permission `auth.manage`. Các route `/api/v1/*/admin/*` dùng `PlatformAdminGuard`.

### Ma trận platform (mặc định seed)

| Platform role | Mô tả | Permissions chính (seed) |
|---------------|--------|---------------------------|
| **admin** | Quản trị nền tảng | Toàn bộ, gồm `auth.manage` |
| **member** | Người dùng thường | `users.*`, `workspaces.*`, `tasks.*`, `notifications.read` |
| **viewer** | Stakeholder read-only | `users.read`, `workspaces.read`, `tasks.read`, `notifications.read` |

### Platform admin làm được gì (không thay workspace owner)

| Hành động | Route ví dụ | Ghi chú |
|-----------|-------------|---------|
| Quản lý role/permission auth | `GET/POST /auth/admin/roles`, assign permission | Không đụng workspace membership |
| Ban/unban user, revoke session | `PATCH /auth/admin/users/:id/active-status` | |
| Liệt kê / xóa user (GDPR) | `GET /users/admin/all`, `DELETE /users/admin/:id` | |
| Liệt kê / force-delete workspace | `GET/DELETE /workspaces/admin/*` | Audit log bắt buộc |
| Force-join workspace điều tra | `POST /workspaces/admin/:id/force-join` | Body `role: "member"` — **không** promote owner |
| Broadcast hệ thống | `POST /notifications/admin/broadcast` | |

### Platform member / viewer vs directory

- `GET /users` và `GET /users/search` **bắt buộc** query `q` trừ khi là platform admin (`403 DIRECTORY_QUERY_REQUIRED`).
- Platform **viewer** có thể đăng nhập nhưng không có quyền ghi workspace/task nếu không phải workspace member.

---

## Workspace roles (`workspace-service`)

Thứ bậc: **`owner` > `manager` > `member`**.

| Workspace role | Cách có role | Trạng thái implement |
|----------------|--------------|----------------------|
| **owner** | Tạo workspace (người tạo) | **Done** |
| **manager** | Owner promote từ `member` | **Planned** (Phase 1–4) |
| **member** | Accept invite; mặc định khi join | **Done** |

Accept invitation **luôn** tạo membership `member` — không invite thẳng lên `manager` hoặc `owner`.

---

## Ma trận quyền workspace (target — Strict MVP)

Ký hiệu: ✅ được phép · ❌ không · 🔜 planned (chưa code).

| Hành động | owner | manager | member |
|-----------|:-----:|:-------:|:------:|
| Xem workspace / members / activity | ✅ | ✅ | ✅ |
| Tạo / sửa project | ✅ | ✅ | ❌ |
| Xóa (soft) project | ✅ | ✅ | ❌ |
| Mời thành viên (`POST .../invite`) | ✅ | ✅ | ❌ |
| Xem pending invitations (workspace) | ✅ | ✅ | ✅ |
| Sửa tên/mô tả workspace (`PATCH`) | ✅ | ❌ | ❌ |
| Xóa workspace (`DELETE`) | ✅ | ❌ | ❌ |
| Promote `member` → `manager` | ✅ | ❌ | ❌ |
| Demote `manager` → `member` | ✅ | ❌ | ❌ |
| Remove **member** khác | ✅ | ✅ | ❌ |
| Remove **manager** khác | ✅ | ❌ | ❌ |
| Remove **owner** | ❌ | ❌ | ❌ |
| Tự rời workspace (leave) | ❌* | ✅ | ✅ |

\* Owner không thể leave nếu chưa transfer ownership (chưa có API transfer — out of scope MVP).

### Task / comment (`task-service`)

Mọi thành viên workspace (`owner`, `manager`, `member`) đều có thể tạo/sửa task, comment, assign trong workspace đó (membership guard). Không có workspace-role riêng trên từng task — chỉ cần `isMember`.

---

## API end-user liên quan role (workspace)

| Method | Path | Quyền tối thiểu (target) | Trạng thái |
|--------|------|---------------------------|------------|
| `PATCH` | `/workspaces/:id` | owner | Done (hiện chỉ owner) |
| `DELETE` | `/workspaces/:id` | owner | Done |
| `POST` | `/workspaces/:id/invite` | owner hoặc manager | Done (hiện chỉ owner) |
| `PATCH` | `/workspaces/:id/members/:userId` body `{ role: "manager" \| "member" }` | owner | **Planned** |
| `DELETE` | `/workspaces/:id/members/:userId` | owner (remove manager/member); self leave | Partial (hiện chỉ owner remove) |

Internal S2S: `GET /workspaces/internal/:id/membership` trả `{ isMember, role }` với `role` ∈ `owner` | `manager` | `member`.

---

## Seed & tài khoản demo

Password mặc định: `collabspace123` — chi tiết [README.md](../README.md) § Seeded Development Accounts.

| Email | Platform | Workspace (ví dụ) | Dùng để test |
|-------|----------|-------------------|--------------|
| `tho@`, `trungtin@` | admin | Infra Ops (owner/member) | `/admin/*`, force-join |
| `ngocanh@` | member | Demo **owner** | User A MVP |
| `quangtien@` | member | Product Lab **owner** | User B, workspace thứ 2 |
| `viewer.only@` | viewer | *(không member)* | 403 workspace |
| `dev.eve@` | member | pending invite | `/invitations/me` |

Sau Phase 5 seed: thêm user có role workspace `manager` trong ít nhất một workspace.

---

## Lộ trình implement (tham chiếu)

| Phase | Nội dung |
|-------|----------|
| **0** | **Docs** — tài liệu này + đồng bộ `features`, `service-contracts`, `api-routes` |
| 1 | Contract: enum `owner` \| `manager` \| `member`, DTO, task-service hierarchy |
| 2 | workspace-service: promote/demote, invite/remove theo ma trận |
| 3 | task-service: `meetsWorkspaceRole` owner > manager > member |
| 4 | Frontend: Make manager / Demote, ẩn action theo actor role |
| 5 | Seed + tests |
| 6 | Migration dữ liệu (nếu cần) + verify |

---

## Tài liệu cập nhật cùng Phase 0

- [features.md](./features.md) § Workspace
- [api-routes.md](./api-routes.md)
- [.claude/docs/service-contracts.md](../.claude/docs/service-contracts.md)
- [team/admin-backlog.md](./team/admin-backlog.md)
- [README.md](../README.md)
- `services/workspace-service/CLAUDE.md`

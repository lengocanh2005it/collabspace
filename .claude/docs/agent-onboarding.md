# CollabSpace Agent Onboarding

Hướng dẫn này dành cho AI agents (Claude Code, Cursor, v.v.) làm việc trên repo CollabSpace.

## Bắt đầu nhanh

1. Đọc `CLAUDE.md` ở root — quy tắc cốt lõi, ports, commands.
2. Xác định service sở hữu feature (xem bảng dưới).
3. Đọc doc chi tiết trong `.claude/docs/` tương ứng với task.
4. Dùng skill phù hợp (`/collabspace-codebase`, `/nest-service-change`, …).
5. Chỉnh code, chạy verify, cập nhật docs nếu contract/MVP status đổi.

## Cấu trúc agent docs

```text
CLAUDE.md                    # Loaded mỗi session — giữ ngắn (<200 dòng)
.claude/
├── settings.json            # Permissions, env (team-shared)
├── settings.local.json      # Override cá nhân (gitignore)
├── agents/                  # Subagents chuyên biệt
├── rules/                   # Rules theo path (auth, user, infra)
├── skills/                  # Workflows tái sử dụng (/skill-name)
└── docs/                    # Reference docs (đọc khi cần)
services/
├── auth-service/CLAUDE.md
├── user-service/CLAUDE.md
├── workspace-service/CLAUDE.md
├── task-service/CLAUDE.md
└── notification-service/CLAUDE.md
```

## Service ownership

| Domain | Service | Path | Status |
|--------|---------|------|--------|
| Auth, JWT, OTP, sessions | auth-service | `services/auth-service` | Done |
| Profiles, usernames, search | user-service | `services/user-service` | Done |
| Workspaces, invites, roles | workspace-service | `services/workspace-service` | Partial |
| Projects, tasks, comments | task-service | `services/task-service` | Partial |
| Notifications, events | notification-service | `services/notification-service` | Partial |
| Routing | api-gateway | `api-gateway` | Config |
| Docker, k8s, monitoring | infrastructure | `infrastructure` | Partial |

## Doc map — đọc file nào?

| Task | Read first |
|------|------------|
| Architecture, topology | `.claude/docs/project-architecture.md` |
| **Kiến trúc từng service (folder, pattern)** | `.claude/docs/service-architecture.md` |
| Resilience, failure handling | `.claude/docs/resilience.md` (+ `docs/resilience-overview.md` tiếng Việt) |
| HTTP/gRPC/events | `.claude/docs/service-contracts.md` |
| Build, test, Docker, seed | `.claude/docs/development-workflows.md` |
| NestJS style, DTOs, tests | `.claude/docs/coding-conventions.md` |
| MVP gaps, build order | `.claude/docs/mvp-roadmap.md` |
| Human MVP scope (Vietnamese) | `docs/mvp-demo-scope.md` |

## Skills

| Skill | When |
|-------|------|
| `/collabspace-codebase` | Orient, architecture, service ownership |
| `/nest-service-change` | auth-service or user-service code changes |
| `/mvp-feature-planner` | Continue MVP, workspace/task/notification |
| `/local-dev-verify` | Build, test, Docker, health checks |

## Subagents

| Agent | When |
|-------|------|
| `nest-reviewer` | Review NestJS changes before finishing |
| `mvp-implementer` | Implement a vertical MVP slice |
| `contract-guardian` | API/proto/event contract changes |

Invoke explicitly: *"Use the nest-reviewer agent to review my changes."*

## Working rules

- **Scope**: Giữ thay đổi trong service sở hữu trừ khi task yêu cầu integration.
- **Patterns**: Đọc `.claude/docs/service-architecture.md` và code lân cận; **không** copy kiến trúc service khác.
- **Secrets**: Không commit `.env`; dùng `.env.example`.
- **Ports**: workspace-service chạy `8080` trong container, không phải `3000`.
- **Package manager**: `pnpm` từ thư mục service; không có root `package.json`.
- **Tests**: Thêm/cập nhật test khi behavior user-visible thay đổi.
- **Docs**: Cập nhật `.claude/docs/service-contracts.md` khi đổi route/proto/event.
- **Resilience**: Đọc `.claude/docs/resilience.md` trước khi sửa gRPC, health, outbox, RabbitMQ, hoặc hành vi khi dependency down.

## Verification checklist

Sau khi sửa code:

1. `pnpm run build` trong service đích.
2. `pnpm run test` (và `test:e2e` nếu đổi routing/validation/auth).
3. Health check nếu chạy Docker: `curl localhost:3000/api/v1/auth/health`.
4. Báo cáo commands đã chạy và kết quả pass/fail.

## "Continue MVP" default

Nếu user không chỉ rõ service → bắt đầu **workspace-service** (unlock membership cho task/notification).

Thứ tự: workspace → project/board → task → comments/mentions → notifications.

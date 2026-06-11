# CollabSpace Agent Onboarding

Hướng dẫn này dành cho AI agents (Claude Code, Cursor, v.v.) làm việc trên repo CollabSpace.

## Bắt đầu nhanh

1. Đọc `CLAUDE.md` ở root — quy tắc cốt lõi, ports, commands.
2. Xác định service sở hữu feature (xem bảng dưới).
3. Đọc doc chi tiết trong `.claude/docs/` tương ứng với task.
4. Dùng skill phù hợp (`/collabspace-codebase`, `/nest-service-change`, …).
5. Chỉnh code, chạy verify, **cập nhật agent docs + skills liên quan** nếu contract/MVP/vận hành đổi (xem [Docs & skills sync](#docs--skills-sync-khi-sửa-code)).

## Cấu trúc agent docs

```text
CLAUDE.md                    # Loaded mỗi session — giữ ngắn (<200 dòng)
.claude/
├── settings.json            # Permissions, env (team-shared)
├── settings.local.json      # Override cá nhân (gitignore)
├── agents/                  # Subagents chuyên biệt
├── rules/                   # Rules theo path (auth, user, infra, docs-and-skills-sync)
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
| Workspaces, invites, roles | workspace-service | `services/workspace-service` | Done |
| Projects, tasks, comments | task-service | `services/task-service` | Done |
| Notifications, events | notification-service | `services/notification-service` | Done |
| Routing | api-gateway | `api-gateway` | Config |
| Docker, k8s, monitoring | infrastructure | `infrastructure` | Partial |

## Doc map — đọc file nào?

| Task | Read first |
|------|------------|
| Architecture, topology | `.claude/docs/project-architecture.md` |
| **Kiến trúc từng service (folder, pattern)** | `.claude/docs/service-architecture.md` |
| Resilience, failure handling | `.claude/docs/resilience.md` (+ `docs/resilience-overview.md` tiếng Việt) |
| HTTP/gRPC/events | `.claude/docs/service-contracts.md` |
| Trust boundaries (auth, gateway, S2S) | `docs/production-hardening.md`, `docs/api-routes.md` |
| Cross-service reads / replicas | `docs/cross-service-data.md`, `.claude/docs/read-models.md` |
| Build, test, Docker, seed | `.claude/docs/development-workflows.md` |
| Secrets (Vault, ESO, shared env) | `infrastructure/vault/README.md`, `docs/production-hardening.md` |
| NestJS style, DTOs, tests | `.claude/docs/coding-conventions.md` |
| Product features & status | `docs/features.md` |
| MVP build order (agent) | `.claude/docs/mvp-roadmap.md` |
| MVP demo acceptance | `docs/mvp-demo-scope.md` |

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
- **Secrets**: Không commit `.env`; contract trong `*.env.example`. **HashiCorp Vault** (`infrastructure/vault/`): optional local dev; staging/prod qua ESO → K8s `Secret` → `envFrom`. App NestJS chỉ đọc env — không gọi Vault API trực tiếp.
- **Ports**: workspace-service chạy `8080` trong container, không phải `3000`.
- **Package manager**: `pnpm` — từ root (`pnpm run build|test`) hoặc từng `services/*`; workspace: `pnpm-workspace.yaml` + `packages/shared`.
- **Tests**: Thêm/cập nhật test khi behavior user-visible thay đổi.
- **Docs & skills**: Khi sửa code ảnh hưởng contract/MVP/vận hành → cập nhật doc + skill liên quan **cùng PR** (không chỉ `service-contracts.md`).
- **Resilience**: Đọc `.claude/docs/resilience.md` trước khi sửa gRPC, health, outbox, RabbitMQ, hoặc hành vi khi dependency down.

## Docs & skills sync khi sửa code

**Quy ước:** code là nguồn sự thật; nếu code đổi mà agent docs/skills không đổi, agent sau sẽ làm sai. Rule tự load: `.claude/rules/docs-and-skills-sync.md`.

### Bắt buộc cập nhật khi

- Route HTTP, gRPC, event RabbitMQ, header auth/S2S
- Biến môi trường, port, gateway Traefik
- Trạng thái tính năng (Done / Planned / gap backlog)
- Health, degradation, outbox, idempotency behavior
- Lệnh migrate/seed/test/verify trong workflow

### Bản đồ doc/skill theo loại thay đổi

| Loại thay đổi | Agent docs | Human `docs/` | Skills / rules |
|---------------|------------|---------------|----------------|
| API & contract | `service-contracts.md` | `api-routes.md`, `features.md` | `contract-guardian` agent; `mvp-feature-planner` nếu slice MVP |
| Auth / trust | `resilience.md` §4 | `production-hardening.md`, `trade-offs.md` | `.claude/rules/<service>.md`, `nest-service-change` |
| Read model / replica | `read-models.md` | `cross-service-data.md` | `collabspace-codebase` |
| Kiến trúc / ownership | `project-architecture.md`, `service-architecture.md` | `README.md` | `collabspace-codebase` |
| MVP / demo | `mvp-roadmap.md` | `mvp-demo-scope.md`, `features.md` | `mvp-feature-planner`, `mvp-implementer` |
| Local verify | `development-workflows.md` | — | `local-dev-verify` |
| NestJS pattern service | `coding-conventions.md` | — | `nest-service-change`, `services/*/CLAUDE.md` |
| Infra only | — | `production-hardening.md`, `infrastructure/vault/README.md`, team backlog | `local-dev-verify`; rule `infrastructure.md` |
| Vault / shared secrets | — | `infrastructure/vault/README.md`, `production-hardening.md` | `local-dev-verify`, `collabspace-codebase` |
| Backlog đóng task | — | `team/application-backlog.md` hoặc `phan-phu-tho-infrastructure-backlog.md` | — |

### Skills cần rà khi đổi code

| Skill | Rà khi |
|-------|--------|
| `/collabspace-codebase` | Ownership, architecture answer, orientation đổi |
| `/nest-service-change` | Quy trình auth/user NestJS, verify steps, conventions |
| `/mvp-feature-planner` | Slice template, default priority, checklist implement |
| `/local-dev-verify` | Lệnh build/test/docker/health trong skill lệch thực tế |

Nếu skill mô tả bước **không còn đúng** sau khi sửa code → sửa file `SKILL.md` tương ứng trong `.claude/skills/`.

### Không bắt buộc

- Refactor nội bộ không đổi API/event/env
- Comment, format, rename private symbol
- Thay đổi chỉ trong test không đổi contract

## Verification checklist

Sau khi sửa code:

1. `pnpm run build` trong service đích.
2. `pnpm run test` (và `test:e2e` nếu đổi routing/validation/auth).
3. Health check nếu chạy Docker: `curl localhost:3000/api/v1/auth/health`.
4. Báo cáo commands đã chạy và kết quả pass/fail.
5. Liệt kê **agent docs + skills** đã cập nhật (hoặc "không cần sync").

## "Continue MVP" default

Đọc `docs/features.md` trước — **backend MVP APIs đã Done** (board, mark-read, delete task, Phase B/C).

Ưu tiên còn lại (2026-06 sync):

1. E2E per service (workspace, task, notification) + gắn `scripts/demo-e2e` vào CI
2. Workspace-level activity feed; OpenAPI workspace + notification
3. Contract test / chuẩn hóa logging-tracing — xem [application-backlog.md](../../docs/team/application-backlog.md) § Cross-cutting
4. Infra vận hành → `docs/team/phan-phu-tho-infrastructure-backlog.md`

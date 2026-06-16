# CollabSpace Agent Instructions

Cross-tool index for **Claude Code**, **Cursor**, and **Codex**. Canonical shared docs live in `.claude/`; `CLAUDE.md` is the primary entry point for Claude/Cursor.

## Multi-tool layout

| Tool | Entry | Skills | Subagents | Path rules |
|------|-------|--------|-----------|------------|
| Claude Code / Cursor | `CLAUDE.md` | `.claude/skills/` | `.claude/agents/*.md` | `.claude/rules/` |
| Codex | `AGENTS.md` (this file) | `.agents/skills/` (mirror) | `.codex/agents/*.toml` | — (read `.claude/rules/` when relevant) |

**Canonical source:** `.claude/docs/`, `.claude/rules/`, `.claude/skills/`, `.claude/agents/`.  
**Do not** duplicate docs under `.Codex/docs/` — that path was removed.

After editing `.claude/skills/`, run `bash scripts/sync-agent-docs.sh` (or `pwsh scripts/sync-agent-docs.ps1`) to refresh `.agents/skills/`. After editing `.claude/agents/*.md`, update matching `.codex/agents/*.toml` manually.

## Start here

1. [CLAUDE.md](./CLAUDE.md) — core rules, ports, commands (loaded every session)
2. [.claude/docs/agent-onboarding.md](./.claude/docs/agent-onboarding.md) — full agent guide and doc map

## Deep reference (read when relevant)

| Doc | Purpose |
|-----|---------|
| `.claude/docs/project-architecture.md` | Services, topology, completion status |
| `.claude/docs/service-architecture.md` | **Per-service folder layout, patterns, where to add code** |
| `.claude/docs/resilience.md` | Design for failure, degradation matrix, error policy |
| `docs/resilience-overview.md` | Human-facing resilience summary (Vietnamese) |
| `.claude/docs/service-contracts.md` | HTTP, gRPC, events, auth headers |
| `.claude/docs/development-workflows.md` | Docker, migrate, seed, test, troubleshoot |
| `.claude/docs/droplet-vps-operations.md` | **Droplet VPS** — SSH, CI deploy, probe/NODE_PATH, rollout timeout |
| `.claude/docs/coding-conventions.md` | NestJS, DTO, TypeORM, test style |
| `docs/features.md` | Product features and status (canonical) |
| `docs/roles-and-permissions.md` | **Platform admin vs workspace owner/manager/member** |
| `docs/api-routes.md` | HTTP route index, gateway headers, internal API rules |
| `docs/service-urls.md` | Prod/local URLs: API, Swagger, Grafana, dashboards |
| `docs/cross-service-data.md` | Read models, replicas, S2S patterns (human, VI) |
| `docs/nfrs.md` | Non-functional requirements |
| `docs/trade-offs.md` | Architecture trade-offs |
| `docs/production-hardening.md` | Prod checklist (Phase B trust boundaries, Phase C correlation ID) |
| `docs/observability.md` | **Grafana, Prometheus, Loki, k6** — dashboards & vận hành K8s |
| `infrastructure/vault/README.md` | **HashiCorp Vault** — local dev, KV layout, ESO → K8s Secrets |
| `docs/team/phan-phu-tho-infrastructure-backlog.md` | Infra/DevOps backlog (Phan Phú Thọ) |
| `docs/team/application-backlog.md` | Application backlog (Lê Ngọc Anh, Ngô Quang Tiến, Võ Trung Tín) |
| `docs/deployment-k3s-phases.md` | Lộ trình production DO — k3s + Helm + Vault + ESO (theo phase) |
| `docs/digitalocean-production-options.md` | So sánh phương án triển khai DigitalOcean |
| `docs/deployment-digitalocean-droplet.md` | Deploy legacy Docker Compose trên Droplet |
| `docs/README.md` | Chỉ mục tài liệu `docs/` (tiếng Việt) |
| `docs/backup-policy.md` | RPO/RTO, backup scripts, restore drill policy |
| `.claude/docs/mvp-roadmap.md` | MVP build order for agents |
| `docs/mvp-demo-scope.md` | MVP demo acceptance checklist |

## When changing code — sync docs & skills

If a code change affects **API contracts, events, env, auth, resilience, MVP status, or verify workflows**, update related **agent docs** and **skills** in the **same PR** when necessary.

- Guide: [.claude/docs/agent-onboarding.md](./.claude/docs/agent-onboarding.md) → **Docs & skills sync**
- Auto rule (loads on `services/**`, `infrastructure/**`, …): [.claude/rules/docs-and-skills-sync.md](./.claude/rules/docs-and-skills-sync.md)

Report which doc/skill files were updated in the completion summary (or state that sync was not required).

## Automation

- **Skills** (`.claude/skills/`; Codex mirror `.agents/skills/`): `/collabspace-codebase`, `/nest-service-change`, `/mvp-feature-planner`, `/local-dev-verify`
- **Subagents** — Claude/Cursor: `.claude/agents/`; Codex: `.codex/agents/` — `nest-reviewer`, `mvp-implementer`, `contract-guardian`
- **Path rules** (`.claude/rules/`): auto-load when editing matching service paths (incl. `docs-and-skills-sync.md`)
- **Sync script**: `scripts/sync-agent-docs.sh` / `.ps1` — copies skills `.claude/skills/` → `.agents/skills/`

## Service-local context

- `services/auth-service/CLAUDE.md`
- `services/user-service/CLAUDE.md`
- `services/workspace-service/CLAUDE.md`
- `services/task-service/CLAUDE.md`
- `services/notification-service/CLAUDE.md`

Path rules (auto-load when editing): `.claude/rules/<service>.md`

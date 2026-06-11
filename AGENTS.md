# CollabSpace Agent Instructions

This repository uses **Claude Code**-style agent documentation. `CLAUDE.md` is the primary entry point.

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
| `.claude/docs/coding-conventions.md` | NestJS, DTO, TypeORM, test style |
| `docs/features.md` | Product features and status (canonical) |
| `docs/api-routes.md` | HTTP route index, gateway headers, internal API rules |
| `docs/cross-service-data.md` | Read models, replicas, S2S patterns (human, VI) |
| `docs/nfrs.md` | Non-functional requirements |
| `docs/trade-offs.md` | Architecture trade-offs |
| `docs/production-hardening.md` | Prod checklist (Phase B trust boundaries, Phase C correlation ID) |
| `docs/team/phan-phu-tho-infrastructure-backlog.md` | Infra/DevOps backlog (secrets, backup, CI/CD, observability) |
| `docs/backup-policy.md` | RPO/RTO, backup scripts, restore drill policy |
| `.claude/docs/mvp-roadmap.md` | MVP build order for agents |
| `docs/mvp-demo-scope.md` | MVP demo acceptance checklist |

## Automation

- **Skills** (`.claude/skills/`): `/collabspace-codebase`, `/nest-service-change`, `/mvp-feature-planner`, `/local-dev-verify`
- **Subagents** (`.claude/agents/`): `nest-reviewer`, `mvp-implementer`, `contract-guardian`
- **Path rules** (`.claude/rules/`): auto-load when editing matching service paths

## Service-local context

- `services/auth-service/CLAUDE.md`
- `services/user-service/CLAUDE.md`
- `services/workspace-service/CLAUDE.md`
- `services/task-service/CLAUDE.md`
- `services/notification-service/CLAUDE.md`

Path rules (auto-load when editing): `.claude/rules/<service>.md`

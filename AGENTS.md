# CollabSpace Agent Instructions

This repository uses **Claude Code**-style agent documentation. `CLAUDE.md` is the primary entry point.

## Start here

1. [CLAUDE.md](./CLAUDE.md) — core rules, ports, commands (loaded every session)
2. [.claude/docs/agent-onboarding.md](./.claude/docs/agent-onboarding.md) — full agent guide and doc map

## Deep reference (read when relevant)

| Doc | Purpose |
|-----|---------|
| `.claude/docs/project-architecture.md` | Services, topology, completion status |
| `.claude/docs/resilience.md` | Design for failure, degradation matrix, error policy |
| `docs/resilience-overview.md` | Human-facing resilience summary (Vietnamese) |
| `.claude/docs/service-contracts.md` | HTTP, gRPC, events, auth headers |
| `.claude/docs/development-workflows.md` | Docker, migrate, seed, test, troubleshoot |
| `.claude/docs/coding-conventions.md` | NestJS, DTO, TypeORM, test style |
| `.claude/docs/mvp-roadmap.md` | MVP gaps and build order |
| `docs/mvp-demo-scope.md` | Human-facing MVP scope |

## Automation

- **Skills** (`.claude/skills/`): `/collabspace-codebase`, `/nest-service-change`, `/mvp-feature-planner`, `/local-dev-verify`
- **Subagents** (`.claude/agents/`): `nest-reviewer`, `mvp-implementer`, `contract-guardian`
- **Path rules** (`.claude/rules/`): auto-load when editing matching service paths

## Service-local context

- `services/auth-service/CLAUDE.md`
- `services/user-service/CLAUDE.md`

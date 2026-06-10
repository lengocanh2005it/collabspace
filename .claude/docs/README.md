# Claude Code Docs For CollabSpace

Detailed project context for AI agents. Keep root `CLAUDE.md` concise; put long procedures in skills or here.

## Files

| File | Purpose |
|------|---------|
| `agent-onboarding.md` | Agent quickstart, doc map, skills/subagents, verification checklist |
| `resilience.md` | Design for failure: timeouts, errors, events, degradation matrix, GAPs |
| `project-architecture.md` | System map, service ownership, infrastructure, data stores |
| `service-architecture.md` | Per-service folder layout, layering patterns, where to add code |
| `service-contracts.md` | HTTP routes, gRPC, events, auth headers |
| `development-workflows.md` | Setup, Docker, migrations, seeding, testing, troubleshooting |
| `coding-conventions.md` | NestJS, TypeORM, DTO, repository, error, test conventions |
| `mvp-roadmap.md` | Recommended build order for agents (status → `docs/features.md`) |

## Human-facing docs (`docs/`)

| File | Purpose |
|------|---------|
| `features.md` | **Canonical** product features and implementation status |
| `mvp-demo-scope.md` | MVP demo story and acceptance checklist |
| `resilience-overview.md` | Resilience summary (Vietnamese) |

## Related config (not in this folder)

| Path | Purpose |
|------|---------|
| `CLAUDE.md` | Loaded every session |
| `AGENTS.md` | Cross-tool agent index |
| `.claude/skills/` | Invocable workflows (`/skill-name`) |
| `.claude/agents/` | Subagents (`nest-reviewer`, `mvp-implementer`, `contract-guardian`) |
| `.claude/rules/` | Path-scoped rules per service (auth, user, workspace, task, notification, infra, resilience) |
| `.claude/settings.json` | Permissions and env defaults |
| `.claudeignore` | Files excluded from agent context |
| `services/*/CLAUDE.md` | Service-local context (loads when working in that directory) |

## Maintenance Rules

- Update docs when service boundaries, ports, routes, env vars, migrations, MVP status, or resilience/degradation behavior change.
- Keep `CLAUDE.md` under roughly 200 lines.
- Prefer precise file paths and concrete commands over general advice.
- If a doc conflicts with code, trust code first and update the doc.

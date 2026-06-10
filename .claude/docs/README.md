# Claude Code Docs For CollabSpace

Detailed project context for AI agents. Keep root `CLAUDE.md` concise; put long procedures in skills or here.

## Files

| File | Purpose |
|------|---------|
| `agent-onboarding.md` | Agent quickstart, doc map, skills/subagents, verification checklist |
| `project-architecture.md` | System map, service ownership, infrastructure, data stores |
| `service-contracts.md` | HTTP routes, gRPC, events, auth headers |
| `development-workflows.md` | Setup, Docker, migrations, seeding, testing, troubleshooting |
| `coding-conventions.md` | NestJS, TypeORM, DTO, repository, error, test conventions |
| `mvp-roadmap.md` | Implementation status, demo story, recommended build order |

## Related config (not in this folder)

| Path | Purpose |
|------|---------|
| `CLAUDE.md` | Loaded every session |
| `AGENTS.md` | Cross-tool agent index |
| `.claude/skills/` | Invocable workflows (`/skill-name`) |
| `.claude/agents/` | Subagents (`nest-reviewer`, `mvp-implementer`, `contract-guardian`) |
| `.claude/rules/` | Path-scoped rules for auth, user, infrastructure |
| `.claude/settings.json` | Permissions and env defaults |
| `.claudeignore` | Files excluded from agent context |
| `services/*/CLAUDE.md` | Service-local context (loads when working in that directory) |

## Maintenance Rules

- Update docs when service boundaries, ports, routes, env vars, migrations, or MVP status change.
- Keep `CLAUDE.md` under roughly 200 lines.
- Prefer precise file paths and concrete commands over general advice.
- If a doc conflicts with code, trust code first and update the doc.

# Claude Code Docs For CollabSpace

Detailed project context for AI agents. Keep root `CLAUDE.md` concise; put long procedures in skills or here.

## Files

| File | Purpose |
|------|---------|
| `agent-onboarding.md` | Agent quickstart, doc map, skills/subagents, verification checklist |
| `resilience.md` | Design for failure: timeouts, errors, events, degradation matrix, GAPs |
| `project-architecture.md` | System map, service ownership, infrastructure, data stores |
| `service-architecture.md` | Per-service folder layout, layering patterns, where to add code |
| `service-contracts.md` | HTTP routes, gRPC, events, auth headers, internal S2S |
| `read-models.md` | User replica pattern and env |
| `development-workflows.md` | Setup, Docker, Vault, migrations, seeding, testing, troubleshooting |
| `coding-conventions.md` | NestJS, TypeORM, DTO, repository, error, test conventions |
| `mvp-roadmap.md` | Recommended build order for agents (status → `docs/features.md`) |

## Human-facing docs (`docs/`)

| File | Purpose |
|------|---------|
| `features.md` | **Canonical** product features and implementation status |
| `api-routes.md` | HTTP route index, gateway headers, internal API rules |
| `cross-service-data.md` | Read models, replicas, S2S patterns (Vietnamese) |
| `nfrs.md` | Non-functional requirements |
| `trade-offs.md` | Architecture trade-offs (Phase B, Phase C) |
| `production-hardening.md` | Production checklist |
| `mvp-demo-scope.md` | MVP demo story and acceptance checklist |
| `resilience-overview.md` | Resilience summary (Vietnamese) |
| `backup-policy.md` | RPO/RTO, backup/restore policy |
| `team/phan-phu-tho-infrastructure-backlog.md` | Infra backlog (Phan Phú Thọ) |
| `team/application-backlog.md` | App backlog per developer (Anh, Tiến, Tín) |

## Infrastructure docs (not in this folder)

| Path | Purpose |
|------|---------|
| `infrastructure/vault/README.md` | HashiCorp Vault — KV paths, local dev, ESO on K8s, Helm `externalSecrets` |
| `infrastructure/helm/README.md` | Umbrella chart; prod values; Vault + ESO mode |
| `infrastructure/docker/.env.example` | Shared dev secret notes (align with Vault seed defaults) |

## Related config (not in this folder)

| Path | Purpose |
|------|---------|
| `CLAUDE.md` | Loaded every session |
| `AGENTS.md` | Cross-tool agent index |
| `.claude/skills/` | Invocable workflows (`/skill-name`) |
| `.claude/agents/` | Subagents (`nest-reviewer`, `mvp-implementer`, `contract-guardian`) |
| `.claude/rules/` | Path-scoped rules per service + `docs-and-skills-sync.md` (sync docs/skills when code changes) |
| `.claude/settings.json` | Permissions and env defaults |
| `.claudeignore` | Files excluded from agent context |
| `services/*/CLAUDE.md` | Service-local context (loads when working in that directory) |

## Maintenance Rules

- Update docs when service boundaries, ports, routes, env vars, migrations, MVP status, or resilience/degradation behavior change.
- **When changing code:** if the change affects contracts or operations, also update related **agent docs** and **skills** in the same PR (not only human `docs/`). Full map: `agent-onboarding.md` → Docs & skills sync; path rule `../rules/docs-and-skills-sync.md`.
- Keep `CLAUDE.md` under roughly 200 lines.
- Prefer precise file paths and concrete commands over general advice.
- If a doc conflicts with code, trust code first and update the doc.

# CollabSpace Claude Code Guide

## Project Identity

CollabSpace is a workspace collaboration management platform: a mini Notion/Slack/Jira hybrid built as a microservices learning/demo project.

Current MVP goal: complete an end-to-end collaboration demo where users register, verify email, create workspaces, invite members, create projects/tasks, assign tasks, comment with mentions, and view notifications.

## Agent Docs Map

Full onboarding: `.claude/docs/agent-onboarding.md`

Read before broad changes:

- Architecture: `.claude/docs/project-architecture.md`
- **Per-service folder layout & patterns**: `.claude/docs/service-architecture.md`
- Resilience / design for failure: `.claude/docs/resilience.md`
- Service contracts: `.claude/docs/service-contracts.md`
- Workflows: `.claude/docs/development-workflows.md`
- **Droplet VPS ops:** `.claude/docs/droplet-vps-operations.md`
- Conventions: `.claude/docs/coding-conventions.md`
- Product features: `docs/features.md`
- **Roles & permissions:** `docs/roles-and-permissions.md`
- API routes & gateway: `docs/api-routes.md`
- Service & infra URLs: `docs/service-urls.md`
- Trust boundaries (Phase B): `docs/production-hardening.md`, `.claude/docs/service-contracts.md` → Auth Header Propagation
- Correlation ID (Phase C): `X-Request-Id` — `.claude/docs/service-contracts.md` → Correlation ID
- Infra backlog: `docs/team/phan-phu-tho-infrastructure-backlog.md`
- Secrets (HashiCorp Vault): `infrastructure/vault/README.md`
- App backlog (Anh, Tiến, Tín): `docs/team/application-backlog.md`
- Cross-service data: `docs/cross-service-data.md`, `.claude/docs/read-models.md`
- MVP roadmap: `.claude/docs/mvp-roadmap.md`
- MVP demo acceptance: `docs/mvp-demo-scope.md`
- Observability (Grafana/Loki/k6): `docs/observability.md`

Path-scoped rules load automatically from `.claude/rules/` when editing matching files.

Subagents: `.claude/agents/` (`nest-reviewer`, `mvp-implementer`, `contract-guardian`); Codex mirror `.codex/agents/*.toml`. Cross-tool index: `AGENTS.md`.

## Repository Shape

- `services/auth-service`: NestJS + TypeORM authentication and identity service.
- `services/user-service`: NestJS + TypeORM user profile/directory service.
- `services/workspace-service`: NestJS + TypeORM workspace/project/invite service (port 8080).
- `services/task-service`: NestJS + CQRS + MongoDB tasks/comments service.
- `services/notification-service`: NestJS + CQRS + MongoDB notification consumer/list API.
- `infrastructure/docker`: Docker Compose stack.
- `infrastructure/vault`: HashiCorp Vault (dev Compose, seed/sync scripts, ESO manifests).
- `infrastructure/k8s`: Kubernetes manifests.
- `api-gateway`: Traefik static/dynamic config.
- `docs/features.md`: product features and implementation status (canonical).
- `docs/mvp-demo-scope.md`: MVP demo acceptance checklist.

## Hard Project Facts

- `workspace-service` runs on port `8080`, not `3000`.
- HTTP APIs for implemented NestJS services use global prefix `/api/v1`.
- Docker local mapped ports:
  - auth: host `3000` -> container `3000`
  - user: host `3001` -> container `3000`
  - workspace: host `3002` -> container `8080`
  - task: host `3003` -> container `3000`
  - notification: host `3004` -> container `3000`
- **MVP backend APIs** are largely complete per `docs/features.md`; remaining product gaps: workspace-level activity feed, per-service e2e tests, frontend UI. **OpenAPI 5/5** Done (Swagger UI + response schemas, gateway `/swagger/<service>`). **Demo E2E script:** `scripts/demo-e2e.sh` / `.ps1`. **Infra prod gaps:** `docs/team/phan-phu-tho-infrastructure-backlog.md`.
- **pnpm workspace** at repo root (`package.json`, `pnpm-workspace.yaml`) — `pnpm run build|test|lint` from root, or per `services/*`.
- **Lint & format:** Biome at root (`pnpm run format`, `pnpm run lint`); per-service `lint` = ESLint type-checked only. See `docs/tooling/biome-migration.md`.
- Use `pnpm`, not npm, for the NestJS services unless a service-specific file proves otherwise.

## Default Working Style

- Start by reading nearby code, DTOs, entities, repositories, migrations, and tests before editing.
- Keep changes service-local unless the task explicitly crosses service boundaries.
- Preserve existing module style (see `.claude/docs/service-architecture.md`):
  - `auth-service`: clean/hexagonal — `presentation` → `application/use-cases` → `domain` → `infrastructure/` + `integrations/`.
  - `user-service`: presentation → application/use-cases → domain ports → infrastructure.
  - `workspace-service`: presentation → use-cases → domain ports → TypeORM adapters.
  - `task-service` / `notification-service`: CQRS handlers, domain entities, Mongo repositories.
- Service-local cheat sheets: `services/<service>/CLAUDE.md`.
- Add focused tests for new use cases, service methods, repository behavior, gRPC integrations, and controller behavior when the change has user-visible behavior.
- **Docs & skills sync:** when code changes routes, events, env, auth, resilience, or MVP status, update related agent docs (`.claude/docs/`, `services/*/CLAUDE.md`, `.claude/rules/`) and skills (`.claude/skills/` → run `scripts/sync-agent-docs.sh` for `.agents/skills/`) in the same change when needed — see `.claude/docs/agent-onboarding.md` and `.claude/rules/docs-and-skills-sync.md`.
- Avoid broad rewrites, dependency churn, or formatting unrelated files.
- Do not invent production secrets. Use `.env.example` patterns and document required variables.
- **Secrets:** apps read env vars only. **Local:** Vault dev (`docker-compose.vault.yml` → `infrastructure/vault/scripts/`) hoặc `.env` tay. **K8s prod:** Vault + External Secrets Operator → `{app}-secrets`; Helm `global.externalSecrets.enabled: true`. See `infrastructure/vault/README.md`.
- Shared dev values (manual `.env` or Vault seed): `JWT_SECRET`, `SERVICE_JWT_SECRET` (same in user/workspace/task/notification) — `infrastructure/docker/.env.example`.
- `ALLOW_DEV_IDENTITY_HEADERS=true` only in local `.env`, never production.

## Common Commands

From `services/auth-service`:

```sh
pnpm install
pnpm run build
pnpm run test
pnpm run test:e2e
pnpm run lint
pnpm run migrate
pnpm run seed
```

From `services/user-service`:

```sh
pnpm install
pnpm run build
pnpm run test
pnpm run test:e2e
pnpm run lint
pnpm run migrate
pnpm run seed
```

From `infrastructure/docker`:

```sh
docker-compose -f docker-compose.yml -f docker-compose.db.yml -f docker-compose.override.yml up -d
```

Seed demo data in this order:

```sh
cd services/auth-service && pnpm run seed
cd ../user-service && pnpm run seed
cd ../workspace-service && pnpm run seed
cd ../task-service && pnpm run seed
cd ../notification-service && pnpm run seed

# or from repo root
sh ./scripts/seed.sh
```

From repo root (lint / format / build / test):

```sh
pnpm run lint            # CI gate: lint:deps + format:check + biome:check + lint:types (0 warnings)
pnpm run format          # Biome write (services + packages)
pnpm run biome:fix       # Biome format + lint auto-fix
pnpm run build           # compile all workspace packages
pnpm run test            # unit tests all packages
```

Per-service: `pnpm run build`, `pnpm run test`, `pnpm run lint` (ESLint only), `pnpm run format` (Biome via `-w`). Config: `biome.json`, `packages/eslint-config/`. See `.claude/docs/development-workflows.md`.

## Claude Code Skills

Use project skills when the task matches:

- `/collabspace-codebase`: architecture, status, service ownership.
- `/nest-service-change`: auth/user NestJS implementation.
- `/mvp-feature-planner`: workspace/task/notification MVP slices.
- `/local-dev-verify`: build, test, Docker, health checks.

## Resilience

Before cross-service, event, or health-check changes, read `.claude/docs/resilience.md`.
Human summary: `docs/resilience-overview.md`.

## Default MVP Priority

If the user says "continue MVP" without a target, start with `workspace-service`.

## Other Agent Tools

- `AGENTS.md`: cross-tool index (Cursor and others).
- `.claude/settings.json`: team permissions (deny reading `.env`).
- `.claudeignore`: reduce noise from `node_modules`, `dist`, lockfiles.
- Per-service `CLAUDE.md` under `services/auth-service` and `services/user-service`.


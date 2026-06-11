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
- Conventions: `.claude/docs/coding-conventions.md`
- Product features: `docs/features.md`
- API routes & gateway: `docs/api-routes.md`
- Trust boundaries (Phase B): `docs/production-hardening.md`, `.claude/docs/service-contracts.md` → Auth Header Propagation
- Correlation ID (Phase C): `X-Request-Id` — `.claude/docs/service-contracts.md` → Correlation ID
- Infra backlog: `docs/team/phan-phu-tho-infrastructure-backlog.md`
- Cross-service data: `docs/cross-service-data.md`, `.claude/docs/read-models.md`
- MVP roadmap: `.claude/docs/mvp-roadmap.md`
- MVP demo acceptance: `docs/mvp-demo-scope.md`

Path-scoped rules load automatically from `.claude/rules/` when editing matching files.

Subagents in `.claude/agents/`: `nest-reviewer`, `mvp-implementer`, `contract-guardian`.

## Repository Shape

- `services/auth-service`: NestJS + TypeORM authentication and identity service.
- `services/user-service`: NestJS + TypeORM user profile/directory service.
- `services/workspace-service`: NestJS + TypeORM workspace/project/invite service (port 8080).
- `services/task-service`: NestJS + CQRS + MongoDB tasks/comments service.
- `services/notification-service`: NestJS + CQRS + MongoDB notification consumer/list API.
- `infrastructure/docker`: Docker Compose stack.
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
- **MVP backend APIs** are largely complete per `docs/features.md`; remaining product gaps: activity feed, demo E2E script, frontend UI. **Infra prod gaps:** `docs/team/phan-phu-tho-infrastructure-backlog.md`.
- There is no root `package.json`. Run `pnpm` commands from each service directory.
- Use `pnpm`, not npm, for the NestJS services unless a service-specific file proves otherwise.

## Default Working Style

- Start by reading nearby code, DTOs, entities, repositories, migrations, and tests before editing.
- Keep changes service-local unless the task explicitly crosses service boundaries.
- Preserve existing module style (see `.claude/docs/service-architecture.md`):
  - `auth-service`: feature modules under `src/modules/*`, `AppService` orchestration.
  - `user-service`: presentation → application/use-cases → domain ports → infrastructure.
  - `workspace-service`: presentation → use-cases → direct TypeORM repositories.
  - `task-service` / `notification-service`: CQRS handlers, domain entities, Mongo repositories.
- Service-local cheat sheets: `services/<service>/CLAUDE.md`.
- Add focused tests for new use cases, service methods, repository behavior, gRPC integrations, and controller behavior when the change has user-visible behavior.
- Avoid broad rewrites, dependency churn, or formatting unrelated files.
- Do not invent production secrets. Use `.env.example` patterns and document required variables.
- Shared local dev secrets (see `infrastructure/docker/.env.example`): `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN` (same value in user/workspace/task/notification); `ALLOW_DEV_IDENTITY_HEADERS=true` only in local `.env`, never production.

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


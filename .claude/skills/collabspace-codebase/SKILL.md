---
name: collabspace-codebase
description: Understand the CollabSpace repository, architecture, service ownership, current MVP status, and where to make changes. Use when starting work, answering architecture questions, onboarding, or deciding which service owns a feature.
---

# CollabSpace Codebase Skill

Use this skill to orient yourself before making project-wide or service-boundary decisions.

## Required Context

Read these files as needed:

- `README.md`
- `docs/features.md`
- `docs/roles-and-permissions.md` (platform admin vs workspace owner/manager/member)
- `docs/mvp-demo-scope.md`
- `.claude/docs/project-architecture.md`
- `.claude/docs/service-architecture.md` (per-service folder layout and patterns)
- `.claude/docs/service-contracts.md`
- `.claude/docs/mvp-roadmap.md`
- `docs/team/phan-phu-tho-infrastructure-backlog.md` (infra/DevOps gaps)
- `infrastructure/vault/README.md` (HashiCorp Vault — local dev + K8s ESO)
- `docs/observability.md` (Grafana, Prometheus, Loki, k6 on K8s)
- `docs/service-urls.md` (API, Swagger, Grafana URLs — prod & local)

## Orientation Steps

1. Identify the user request category:
   - auth/identity
   - user profile/directory
   - workspace/membership/invite
   - project/board/task/comment
   - notification/activity
   - analytics/admin dashboard
   - infrastructure/observability/CI
2. Map the request to the owning service.
3. Check `docs/features.md` for Done / Planned. All core app services plus
   `dlq-service`, workspace/task activity feeds, task/notification E2E, workspace E2E,
   CI demo smoke, and the Admin Platform APIs are implemented. `analytics-service`
   is partial until live Kafka source topics/events are aligned with the canonical
   event bus. Main gaps are automated contract tests, frontend polish/tests,
   restore drill/offsite backup, capacity baseline, and infra operations.
4. Read `services/<service>/CLAUDE.md` and `.claude/docs/service-architecture.md` for that service's layering rules.
5. Read the target service's `src/app.module.ts`, controllers, use cases/handlers, entities, repositories, migrations, and tests.
6. For **TypeORM migrations** (auth, workspace): file `{timestamp}-{PascalCase}.ts`, class `{PascalCase}{timestamp}` — see `nest-service-change` skill. user-service uses `migrations/NNN_*.sql`.
7. Summarize the current state before proposing cross-service work.

## Service Ownership

- Auth credentials, roles, permissions, sessions, JWT, OTP: `services/auth-service`.
- User profiles, usernames, display names, user search, profile hydration: `services/user-service`.
- Workspace CRUD, membership, invitations, workspace roles (`owner` / `manager` / `member`): `services/workspace-service`.
- Projects, boards, tasks, comments, mentions, activity: `services/task-service`.
- Notification persistence, notification list/read API, event consumption: `services/notification-service`.
- DLQ ops, Kafka dead-letter inspect/replay workflow: `services/dlq-service`.
- Admin dashboard analytics read model, snapshots, and timeseries: `services/analytics-service`.
- Gateway routing: `api-gateway`.
- Compose/K8s/Vault/observability/CI: `infrastructure` (`infrastructure/vault/` for secrets). **DO Droplet hands-on deploy:** Lê Ngọc Anh (phối hợp Phan Phú Thọ — infra backlog).

**S2S HTTP (internal routes):** chỉ **Service JWT** — `SERVICE_JWT_SECRET` chung trên user/workspace/task/notification; `dlq-service` cũng require secret ở prod bootstrap. Contract: `.claude/docs/service-contracts.md` → Service JWT.

## Output Style

When answering architecture questions:

- Start with the direct answer.
- Mention the exact service/path.
- Call out whether the feature is done, partial, or pending.
- Include the smallest next step if implementation is requested.

When implementing:

- Do not stop at a high-level plan if the request asks for code.
- Keep edits scoped to the owning service unless integration files must change.
- Before push: `pnpm run lint` → `pnpm run build` → `pnpm run test` from repo root (see `local-dev-verify` skill).
- **Docs & skills sync:** if contracts, ports, env vars, events, auth, resilience, or MVP status change, update related agent docs (`.claude/docs/`, `services/*/CLAUDE.md`, `docs/features.md`, …) and skills (this file, `nest-service-change`, `mvp-feature-planner`, `local-dev-verify`) in the **same change** when needed. See `.claude/rules/docs-and-skills-sync.md`.


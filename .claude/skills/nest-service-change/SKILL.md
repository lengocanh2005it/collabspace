---
name: nest-service-change
description: Implement, refactor, test, or debug CollabSpace NestJS services, especially auth-service and user-service. Use when changing controllers, use cases, services, repositories, TypeORM entities, migrations, DTOs, gRPC, or auth/user behavior.
---

# Nest Service Change Skill

Use this skill for NestJS service changes across `services/*`. Auth and user
have extra clean/hexagonal rules below; workspace, task, and notification should
follow their service-local `CLAUDE.md` files plus `.claude/rules/<service>.md`.

## Required Context

Read as needed:

- `.claude/docs/coding-conventions.md`
- `.claude/docs/service-contracts.md`
- `.claude/docs/development-workflows.md`
- Target service `package.json`
- Target service `src/app.module.ts`
- Nearby tests and migrations

## Before Editing

1. Determine the target service.
2. Search for existing examples with `rg`.
3. Read the closest controller, DTO, service/use case, repository, entity, and tests.
4. Decide whether the change is:
   - HTTP-only
   - gRPC contract
   - persistence/schema
   - auth/security
   - cross-service integration
5. Identify the minimum verification commands.

## auth-service Rules

- Use `ConfigurationService` for config access.
- Add new flows as `application/use-cases/<action>.use-case.ts`; wire in `app.module.ts`.
- Inject `USER_REPOSITORY`, `REFRESH_TOKEN_REPOSITORY`, and outbound ports — not legacy `*Service` facades.
- HTTP DTOs in `application/dto/`; domain types in `domain/entities/` and `domain/types/`.
- Use structured Nest exceptions with stable `code` and `message`.
- Never log secrets, OTPs, refresh tokens, or access tokens.
- If changing auth identity returned to downstream services, update:
  - HTTP `verify`
  - gRPC auth controller/types
  - consumers
  - `.claude/docs/service-contracts.md`

## user-service Rules

- Preserve layering:
  - controller/gRPC controller
  - use case
  - repository port
  - infrastructure repository
  - ORM entity/domain mapper
- Use `USER_PROFILE_REPOSITORY` from application/use cases.
- Update both TypeORM and in-memory repository when behavior changes.
- Do not return ORM entities from controllers.
- Current-user endpoints must derive `userId` from auth identity, not request body.

## Schema Change Checklist

When changing PostgreSQL schema:

1. Add/update migration (see **TypeORM migration naming** below).
2. Update TypeORM entity.
3. Update domain entity if user-service.
4. Update repository mapping.
5. Update DTOs if exposed.
6. Update seed script if demo data depends on it.
7. Add/update tests.
8. Update docs if public behavior changed.

### TypeORM migration naming (auth-service, workspace-service)

TypeORM `runMigrations()` on k3s **rejects** class names without a 13-digit JS timestamp suffix. Follow the same pattern as existing migrations in each service.

| Part                | Pattern                       | Example                                        |
| ------------------- | ----------------------------- | ---------------------------------------------- |
| **File**            | `{timestamp}-{PascalCase}.ts` | `1718000000001-CreateAuthOutboxEvents.ts`      |
| **Class**           | `{PascalCase}{timestamp}`     | `CreateAuthOutboxEvents1718000000001`          |
| **`name` property** | same as class                 | `name = 'CreateAuthOutboxEvents1718000000001'` |

**Do**

- Use a unique 13-digit millisecond timestamp (increment from the latest migration in that service).
- Register the class in `src/migrate.ts` (auth: explicit imports; workspace: migrations glob path).
- Run `pnpm run build` locally — compiled output must land under `dist/migrations/` or `dist/src/infrastructure/database/migrations/`.

**Do not**

- `001-create-foo.ts`, `create-foo.ts`, or class `CreateFoo001` — fails on Droplet with _"Migration class name should have a JavaScript timestamp appended"_.
- Rename a migration file/class after it has run in any shared DB (add a new migration instead).

**Paths**

| Service           | Migration folder | k8s migrate command        |
| ----------------- | ---------------- | -------------------------- |
| auth-service      | `migrations/`    | `node dist/src/migrate.js` |
| user-service      | `migrations/`    | `node dist/src/migrate.js` |
| workspace-service | `migrations/`    | `node dist/src/migrate.js` |

Shared runner: `@collabspace/typeorm-migrate` (`migrationsTransactionMode: 'each'`). Create: `scripts/typeorm-migrate/create-migration.sh <auth|user|workspace> <Name>`. Revert: `scripts/typeorm-migrate/revert-migration.sh` or `pnpm run migrate:revert`.

Reference: `services/auth-service/migrations/1718000000001-CreateAuthOutboxEvents.ts`, `services/user-service/migrations/1718000000103-AddSearchIndexes.ts`.

## gRPC Change Checklist

1. Update `.proto`.
2. Regenerate generated TS if a generator exists.
3. Update provider controller.
4. Update consumer client/service.
5. Update tests for both provider and consumer where practical.
6. Update `.claude/docs/service-contracts.md`.

## Verification

For auth-service:

```sh
cd services/auth-service
pnpm run build
pnpm run test
```

For user-service:

```sh
cd services/user-service
pnpm run build
pnpm run test
```

For workspace-service:

```sh
cd services/workspace-service
pnpm run build
pnpm run test
```

For task-service:

```sh
cd services/task-service
pnpm run build
pnpm run test
```

For notification-service:

```sh
cd services/notification-service
pnpm run build
pnpm run test
```

Run `test:e2e` when changing routing, validation, bootstrap, or auth guards/integration.

## Format, lint, build, test

From repo root (CI gate — **0 warnings**):

```sh
pnpm run lint            # lint:ci: deps + format:check + biome:check + lint:types
pnpm run build           # after lint passes, or scoped: cd services/<name> && pnpm run build
pnpm run test            # unit tests
```

Quick fix while editing:

```sh
pnpm run format          # Biome write (services + packages)
pnpm run biome:fix       # Biome format + lint safe fixes
```

Per service: `pnpm run format` (Biome via `-w`), `pnpm run lint` (ESLint only — **not** full CI gate).

- Config: `biome.json` (root), `packages/eslint-config/create-type-checked-config.mjs`.
- Avoid `!` non-null assertions — Biome errors; use guards / `getAuthServiceClient()` pattern.
- ESLint: `void bootstrap()`; unused `_param` prefix.
- See `docs/tooling/biome-migration.md`, `.claude/docs/coding-conventions.md`.

## Service JWT — S2S HTTP (user, workspace, task, notification)

Internal routes (`/users/internal/*`, `/workspaces/internal/*`) use **short-lived Service JWT** only:

| Role | Services | Code |
|------|----------|------|
| Verify inbound | user-service, workspace-service | `assertInternalServiceAccess` → `@collabspace/shared` `assertServiceToServiceAccess` |
| Sign outbound | task-service, notification-service | `buildOutboundServiceAuthHeaders` in `*HttpClient` |

Rules:

- Env **`SERVICE_JWT_SECRET`** — **same value** in all four services per environment (Vault key `service_jwt_secret`).
- Header: `Authorization: Bearer <jwt>` with `iss` / `aud` / `scope` per `service-contracts.md`.
- **No** `INTERNAL_SERVICE_TOKEN`, `X-Internal-Service-Token`, or migration fallback.
- Local dev: `NODE_ENV=development` allows inbound bypass when `SERVICE_JWT_SECRET` unset (tests only); production requires secret.
- Gateway still blocks public access to internal paths (503); cluster DNS + NetworkPolicy for pod-to-pod.

## Docs & skills sync

After code changes, update when **needed** (same PR):

| Change                          | Update                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP/gRPC route or DTO contract | `.claude/docs/service-contracts.md`, `docs/api-routes.md`                                                                                |
| New/changed env / secret key    | `services/*/.env.example`, `development-workflows.md`; if shared secret → `infrastructure/vault/` seed scripts + `external-secrets.yaml` |
| Auth/verify behavior            | `service-contracts.md`, `services/<service>/CLAUDE.md`, `.claude/rules/<service>.md`                                                     |
| S2S HTTP internal auth          | `service-contracts.md` § Service JWT; `@collabspace/shared` `assertServiceToServiceAccess` / `buildOutboundServiceAuthHeaders`; env `SERVICE_JWT_SECRET` only (no `INTERNAL_SERVICE_TOKEN`) |
| TypeORM migration added/renamed | This skill (Schema Change Checklist), `coding-conventions.md`                                                                            |
| Feature status                  | `docs/features.md`, `docs/mvp-demo-scope.md`                                                                                             |
| Verify commands changed         | This skill or `local-dev-verify/SKILL.md`                                                                                                |

Skip for internal refactors with no contract impact. Rule: `.claude/rules/docs-and-skills-sync.md`.

## Completion Response

Include:

- What changed.
- Files touched.
- Tests/commands run.
- Any command that could not run and why.
- **Agent docs + skills updated** (list paths) or explicit "no doc/skill sync required".

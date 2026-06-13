---
name: nest-service-change
description: Implement, refactor, test, or debug CollabSpace NestJS services, especially auth-service and user-service. Use when changing controllers, use cases, services, repositories, TypeORM entities, migrations, DTOs, gRPC, or auth/user behavior.
---

# Nest Service Change Skill

Use this skill for `services/auth-service` and `services/user-service`.

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

1. Add/update migration.
2. Update TypeORM entity.
3. Update domain entity if user-service.
4. Update repository mapping.
5. Update DTOs if exposed.
6. Update seed script if demo data depends on it.
7. Add/update tests.
8. Update docs if public behavior changed.

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

Run `test:e2e` when changing routing, validation, bootstrap, or auth guards/integration.

## Docs & skills sync

After code changes, update when **needed** (same PR):

| Change | Update |
|--------|--------|
| HTTP/gRPC route or DTO contract | `.claude/docs/service-contracts.md`, `docs/api-routes.md` |
| New/changed env / secret key | `services/*/.env.example`, `development-workflows.md`; if shared secret → `infrastructure/vault/` seed scripts + `external-secrets.yaml` |
| Auth/verify behavior | `service-contracts.md`, `services/<service>/CLAUDE.md`, `.claude/rules/<service>.md` |
| Feature status | `docs/features.md`, `docs/mvp-demo-scope.md` |
| Verify commands changed | This skill or `local-dev-verify/SKILL.md` |

Skip for internal refactors with no contract impact. Rule: `.claude/rules/docs-and-skills-sync.md`.

## Completion Response

Include:

- What changed.
- Files touched.
- Tests/commands run.
- Any command that could not run and why.
- **Agent docs + skills updated** (list paths) or explicit "no doc/skill sync required".


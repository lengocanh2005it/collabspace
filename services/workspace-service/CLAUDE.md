# workspace-service

NestJS + TypeORM + PostgreSQL + RabbitMQ. Port **8080** (not 3000).

## Pattern

**Pragmatic layered** — use cases + direct TypeORM `Repository` injection. No domain entities or repository ports yet.

```text
presentation/http → application/use-cases → TypeORM entities
domain/events/     → RabbitMQ routing keys + payload types only
```

## Layout

```text
application/dto/                    # Input DTOs (class-validator)
application/use-cases/
  workspace/ | project/ | invitation/
domain/events/
infrastructure/database/entities/   # *.orm-entity.ts
presentation/http/                  # controllers, guards, decorators
health/
```

## Commands

```sh
pnpm install
pnpm run build
pnpm run test
pnpm run migrate
pnpm run seed
```

## Conventions

- Global prefix `/api/v1`; routes `/workspaces/*`, `/workspaces/:id/projects/*`
- Auth: `X-User-Id` from gateway via `UserIdGuard` + `@UserId()`
- ORM columns snake_case; multi-step writes use transactions
- Events: `collabspace_exchange` + routing key from `domain/events/`
- Tests: `*.use-case.spec.ts` next to use case

## Where to add code

| Task | Path |
|------|------|
| HTTP route | `presentation/http/*controller.ts` |
| Use case | `application/use-cases/<area>/<action>.use-case.ts` |
| Input DTO | `application/dto/` |
| DB entity | `infrastructure/database/entities/` |
| Event name/payload | `domain/events/` |

Deep docs: `@../../.claude/docs/service-architecture.md` (workspace section), `@../../.claude/docs/service-contracts.md`

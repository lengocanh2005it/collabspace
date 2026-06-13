# workspace-service

NestJS + TypeORM + PostgreSQL + RabbitMQ. Port **8080** (not 3000).

## Pattern

**Clean Architecture** — domain entities, repository port interfaces, TypeORM adapters, use cases inject ports only.

```text
presentation/http → application/use-cases → domain/repositories (ports)
                                                  ↑ implemented by
                                          infrastructure/repositories (TypeORM adapters)
```

## Layout

```text
application/dto/                         # Input DTOs (class-validator)
application/use-cases/
  workspace/ | project/ | invitation/    # Inject domain ports via @Inject(SYMBOL)
domain/entities/                         # Workspace, Project, WorkspaceMember, Invitation (plain, no ORM)
domain/repositories/                     # IWorkspaceRepository, IProjectRepository, ... (port interfaces + symbols)
domain/events/                           # RabbitMQ routing keys + payload types
infrastructure/database/entities/        # *.orm-entity.ts (TypeORM)
infrastructure/repositories/             # typeorm-*.repository.ts (port implementations)
presentation/http/                       # controllers, guards, decorators
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

**Swagger:** `http://localhost:8080/swagger` (Docker host port **3002**).

## Conventions

- Global prefix `/api/v1`; routes `/workspaces/*`, `/workspaces/:id/projects/*`, `/workspaces/:id/invitations`
- Public routes: `AuthGuard` + auth gRPC → `@UserId()`; dev fallback `X-User-Id` when `ALLOW_DEV_IDENTITY_HEADERS=true`
- Internal S2S: `GET /workspaces/internal/:id/membership` — `X-Internal-Service-Token` (not on Traefik)
- ORM columns snake_case; multi-step writes use transactions
- Events: `collabspace_exchange` + routing key from `domain/events/`
- TypeORM migrations: `src/infrastructure/database/migrations/{timestamp}-{PascalCase}.ts` — class `{PascalCase}{timestamp}` (xem `nest-service-change` skill / auth-service `migrations/` cùng quy ước)
- Tests: `*.use-case.spec.ts` next to use case; inject in-memory stub implementing the port interface
- Do **not** inject `@InjectRepository(OrmEntity)` in use cases — all DB access goes through port adapters

## Where to add code

| Task | Path |
|------|------|
| HTTP route | `presentation/http/*controller.ts` |
| Use case | `application/use-cases/<area>/<action>.use-case.ts` |
| Domain entity | `domain/entities/` |
| Repository port | `domain/repositories/<name>.repository.ts` |
| TypeORM adapter | `infrastructure/repositories/typeorm-<name>.repository.ts` |
| Input DTO | `application/dto/` |
| DB entity (ORM) | `infrastructure/database/entities/` |
| Event name/payload | `domain/events/` |

Deep docs: `@../../.claude/docs/service-architecture.md` (workspace section), `@../../.claude/docs/service-contracts.md`

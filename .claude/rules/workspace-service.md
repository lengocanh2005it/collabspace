---
paths:
  - "services/workspace-service/**"
---

# workspace-service Rules

- Pattern: **Clean Architecture** — domain entities, repository port interfaces, TypeORM adapters.
- Layering: `presentation/http` → `application/use-cases` → `domain/repositories` (ports) ← `infrastructure/repositories` (adapters).
- Port **8080**; global prefix `api/v1`; routes under `/workspaces`.
- Public identity: `AuthGuard` + auth gRPC → `@UserId()` from `request.user` — never from body.
- Internal membership: `internal-workspace.controller.ts` + `assertInternalServiceAccess` — Service JWT (preferred) or migration `X-Internal-Service-Token`; env `SERVICE_JWT_SECRET`.
- Domain entities: `domain/entities/` (plain, no ORM decorators); port interfaces: `domain/repositories/`.
- TypeORM adapters: `infrastructure/repositories/typeorm-*.repository.ts` — inject `@InjectRepository` here, not in use cases.
- Use cases inject ports via `@Inject(SYMBOL)` and `import { type Interface, SYMBOL }`.
- Input DTOs in `application/dto/`; use cases in `application/use-cases/<area>/`.
- ORM entities: `*.orm-entity.ts`, snake_case columns; transactions handled inside adapters.
- Events: constants in `domain/events/`; publish via `collabspace_exchange` + documented routing key; include `eventId` + `occurredAt`.
- Tests: `*.use-case.spec.ts` next to use case; mock via `{ provide: SYMBOL, useValue: mockObj }`.
- Do **not** inject `@InjectRepository(OrmEntity)` in use cases — all DB access goes through port adapters.
- Deep guide: `.claude/docs/service-architecture.md` (workspace section).
- Verify: `cd services/workspace-service && pnpm run build && pnpm run test`.

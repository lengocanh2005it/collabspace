---
paths:
  - "services/workspace-service/**"
---

# workspace-service Rules

- Pattern: **use case + direct TypeORM Repository** — no repository ports unless explicitly refactoring.
- Layering: `presentation/http` → `application/use-cases` → `infrastructure/database/entities`.
- Port **8080**; global prefix `api/v1`; routes under `/workspaces`.
- Public identity: `AuthGuard` + auth gRPC → `@UserId()` from `request.user` — never from body.
- Internal membership: `internal-workspace.controller.ts` + `assertInternalServiceAccess` — never expose without token.
- Input DTOs in `application/dto/`; use cases in `application/use-cases/<area>/`.
- ORM entities: `*.orm-entity.ts`, snake_case columns; use transactions for multi-table writes.
- Events: constants in `domain/events/`; publish via `collabspace_exchange` + documented routing key; include `eventId` + `occurredAt`.
- Tests: `*.use-case.spec.ts` next to use case.
- Do **not** copy user-service repository-port pattern here without a dedicated refactor task.
- Deep guide: `.claude/docs/service-architecture.md` (workspace section).
- Verify: `cd services/workspace-service && pnpm run build && pnpm run test`.

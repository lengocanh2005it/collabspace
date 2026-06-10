---
paths:
  - "services/task-service/**"
---

# task-service Rules

- Pattern: **Clean + CQRS** — `CommandBus` / `QueryBus`; handlers in `application/usecases/*.handler.ts`.
- Global prefix `api`; version on controller: `@Controller('v1/tasks')`.
- New write flow: `application/commands/` + handler; reads: `application/queries/` + handler.
- Domain rules in `domain/entities/`; persistence in `infrastructure/persistence/` + `repositories/`.
- Register new handlers in `Handlers` array in `app.module.ts`.
- Match **double-quote** style used in this service.
- Events: `eventId` + `occurredAt` in payloads; publish after successful DB write.
- HTTP responses via `presentation/common/response/` (`ok`, `created`).
- Do **not** put Mongoose calls in controllers.
- Do **not** copy auth-service module layout or user-service use-case-only naming (`*.use-case.ts` → use `*.handler.ts` here).
- Deep guide: `.claude/docs/service-architecture.md` (task section).
- Verify: `cd services/task-service && pnpm run build && pnpm run test`.

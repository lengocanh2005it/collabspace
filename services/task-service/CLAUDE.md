# task-service

NestJS + CQRS + Mongoose (MongoDB) + RabbitMQ publisher.

## Pattern

**Clean architecture + CQRS** — controllers use `CommandBus` / `QueryBus`; handlers own business flow.

```text
presentation/controllers → application/usecases/*.handler.ts
                         → domain/entities
                         → application/ports → infrastructure/repositories
```

## Layout

```text
application/commands/ | queries/ | ports/ | usecases/
domain/entities/ | value-objects/ | events/ | exceptions/
infrastructure/persistence/*.schema.ts
infrastructure/repositories/ | mappers/ | messaging/
presentation/controllers/ | dtos/ | guards/
health/
```

## Commands

```sh
pnpm install
pnpm run build
pnpm run test
```

## Event sourcing (Task aggregate)

- Command writes append to Mongo `task_events` (`ITaskEventStore`) then refresh the `tasks` read projection.
- Domain events live in `domain/events/task-domain.events.ts`; aggregate in `domain/entities/Task.ts`.
- Queries use `findByIdAsync` / `findByWorkspaceIdAsync` (projection). Commands use `loadAggregateByIdAsync` + `saveAsync`.
- Legacy tasks without events still load from projection (`version = 0`) until the next command append.
- Attachments remain projection-only updates in phase 1 (not event-sourced).

## Conventions

- Global prefix `api`; controllers `@Controller('v1/tasks')` → `/api/v1/tasks`
- Double-quote import style in this service
- Handlers registered in `Handlers` array in `app.module.ts`
- Domain entities use factories and business methods; throw domain exceptions
- Events: include `eventId` + `occurredAt` in `domain/events/` payloads
- User/workspace context from gateway headers (`request-context.ts`)
- Responses via `presentation/common/response/` helpers

## Where to add code

| Task | Path |
|------|------|
| HTTP route | `presentation/controllers/` |
| Command + handler | `application/commands/` + `application/usecases/` |
| Query + handler | `application/queries/` + `application/usecases/` |
| Domain model | `domain/entities/` |
| Mongo schema | `infrastructure/persistence/` |
| Event listener | `presentation/controllers/internal/` |

Deep docs: `@../../.claude/docs/service-architecture.md` (task section), `@../../.claude/docs/service-contracts.md`

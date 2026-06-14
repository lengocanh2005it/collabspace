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

**Swagger:** `http://localhost:3000/swagger` (Docker host port **3003**).

## Event sourcing (Task aggregate)

- Command writes append to Mongo `task_events` (`ITaskEventStore`) then refresh the `tasks` read projection.
- Domain events live in `domain/events/task-domain.events.ts`; aggregate in `domain/entities/Task.ts`.
- Queries use `findByIdAsync` / `findByWorkspaceIdAsync` (projection). Commands use `loadAggregateByIdAsync` + `saveAsync`.
- Legacy tasks without events still load from projection (`version = 0`) until the next command append.
- Attachments use `TaskAttachmentAdded` / `TaskAttachmentRemoved` domain events.
- Board query: `GET /v1/tasks/board?workspaceId=`.

## Conventions

- Global prefix `api/v1`; controllers `@Controller('tasks')` → `/api/v1/tasks`
- Double-quote import style in this service
- Handlers registered in `Handlers` array in `app.module.ts`
- Domain entities use factories and business methods; throw domain exceptions
- Events: include `eventId` + `occurredAt` in `domain/events/` payloads
- `@UseGuards(AuthGuard, WorkspaceValidationGuard)` — JWT via auth gRPC **Lite**, then workspace membership
- `request.user` from `AuthGuard`; workspace check via internal API + `INTERNAL_SERVICE_TOKEN`
- Env: `AUTH_SERVICE_GRPC_URL`, `ALLOW_DEV_IDENTITY_HEADERS`, `INTERNAL_SERVICE_TOKEN`, `WORKSPACE_CLIENT_MODE=http`
- Attachment storage has two explicit modes:
  - Azure mode: set a real `AZURE_STORAGE_CONNECTION_STRING`; files persist in `AZURE_STORAGE_CONTAINER_NAME`.
  - Mock mode: missing/placeholder connection string returns a plausible Azure URL, but no file is persisted. Use only for local UI/demo work.
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

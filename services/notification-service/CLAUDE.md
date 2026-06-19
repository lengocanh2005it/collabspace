# notification-service

NestJS + CQRS + Mongoose (MongoDB) + RabbitMQ consumer. Event-driven; HTTP is list + health.

## Pattern

**Clean + CQRS** — listeners dispatch commands; handlers persist domain entities.

```text
presentation/controllers/internal/ → CommandBus
application/usecases/<feature>/   → command + handler (one folder per use case)
domain/entities/ | repositories/
infrastructure/database/schemas/ | repositories/
```

## Layout

```text
application/usecases/create-notification/
application/usecases/get-notifications/
domain/entities/ | repositories/ | value-objects/ | events/
infrastructure/database/schemas/ | repositories/
presentation/controllers/notifications.controller.ts
presentation/controllers/internal/*-event-listener.controller.ts
health/
```

## Commands

```sh
pnpm install
pnpm run build
pnpm run test
```

**Swagger:** `http://localhost:3000/swagger` (Docker host port **3004**).

## Conventions

- Global prefix `api/v1`; `@Controller('notifications')` → `/api/v1/notifications`
- Protected HTTP (`GET /`, `PATCH .../read`): `@UseGuards(AuthGuard)` — JWT via auth gRPC **`VerifyAccessTokenLite`**, not `X-User-Id`
- Env: `AUTH_SERVICE_GRPC_URL`, `ALLOW_DEV_IDENTITY_HEADERS`, `SERVICE_JWT_SECRET` (user replica fallback HTTP)
- Idempotency: `ProcessedEvent` + `tryClaim(eventId)` before create
- **Kafka (Phase 2+):** `KAFKA_CONSUMERS_ENABLED=true` — consumer `collabspace.workspace.workspace_invited` dual-run với RMQ
- Listeners pass `eventId` into `CreateNotificationCommand`
- Repository tokens: `NOTIFICATION_REPOSITORY_TOKEN`, `PROCESSED_EVENT_REPOSITORY_TOKEN`
- Readiness: Mongo required; RabbitMQ required when consumer enabled

## Where to add code

| Task | Path |
|------|------|
| New event consumer | `presentation/controllers/internal/` |
| Notification logic | `application/usecases/<name>/` |
| Event payload type | `domain/events/` |
| Mongo schema | `infrastructure/database/schemas/` |

Deep docs: `@../../.claude/docs/service-architecture.md` (notification section), `@../../.claude/docs/service-contracts.md`

---
paths:
  - "services/notification-service/**"
---

# notification-service Rules

- Pattern: **Clean + CQRS, event-first** — listeners → `CommandBus` → handler.
- One folder per use case: `application/usecases/<name>/` (command + handler together).
- Global prefix `api`; `@Controller('v1/notifications')`.
- List/mark-read: `@UseGuards(AuthGuard)` — recipient from `request.user.id`, not `X-User-Id` header.
- Idempotency: always pass `eventId` to `CreateNotificationCommand`; handler uses `tryClaim` before insert.
- Repository interfaces in `domain/repositories/`; Mongoose in `infrastructure/database/`.
- Event payload types in `domain/events/`; listeners in `presentation/controllers/internal/`.
- Ack RabbitMQ only after handler succeeds.
- Do **not** create duplicate notifications on redelivered events.
- Deep guide: `.claude/docs/service-architecture.md` (notification section).
- Verify: `cd services/notification-service && pnpm run build && pnpm run test`.

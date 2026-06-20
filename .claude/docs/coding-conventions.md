# CollabSpace Coding Conventions

## General Principles

- Prefer existing local patterns over new abstractions.
- Keep service boundaries explicit.
- Do not share database tables across services.
- Use `userId` as the cross-service user identity key.
- Keep DTOs and transport payloads stable.
- Add tests where behavior changes.
- **Docs & skills sync:** when code changes affect routes, env, contracts, events, auth, resilience, MVP status, or verify workflows, update the related **agent docs** (`.claude/docs/`, `services/*/CLAUDE.md`, `.claude/rules/`) and **skills** (`.claude/skills/*/SKILL.md`) in the **same change** when needed. See `.claude/docs/agent-onboarding.md` → Docs & skills sync; auto rule `.claude/rules/docs-and-skills-sync.md`.

## Format & lint

Hybrid **Biome + ESLint** (Phase 7 deferred — giữ cả hai). CI / local gate: `pnpm run lint` (= `lint:ci`) phải **0 warnings**.

| Việc | Lệnh | Config |
|------|------|--------|
| Format write | `pnpm run format` | `biome.json` |
| Format check | `pnpm run format:check` | |
| Style lint | `pnpm run biome:check` | `--error-on-warnings`; `noNonNullAssertion: error` |
| Auto-fix style | `pnpm run biome:fix` | Review diff; không dùng unsafe fix bừa |
| Type-aware lint | `pnpm run lint:types` | `@collabspace/eslint-config`, `--max-warnings 0` |
| Full gate | `pnpm run lint:ci` | `lint:deps` → format → biome → ESLint |

- **Quote style** (`biome.json` overrides): single — auth/user/workspace; double — task/notification.
- Per-service `pnpm run format` → `pnpm -w exec biome format …`. Per-service `pnpm run lint` = ESLint only (không thay `lint:ci`).
- **NestJS:** giữ `useImportType: off` và `unsafeParameterDecoratorsEnabled: true` trong `biome.json`.
- **Tránh `!`:** dùng optional chain, guard, hoặc narrow type sau check (Biome error).
- **ESLint:** `no-floating-promises: error`; `void bootstrap()` cho entrypoint; `_` prefix cho unused params/vars.
- **Mapper static classes:** `noStaticOnlyClass: off` (convention hiện tại).

Details: `docs/tooling/biome-migration.md`, `.claude/docs/development-workflows.md`.

## TypeScript/NestJS Style

- Use TypeScript strict-ish patterns already present in each service.
- Prefer dependency injection over module-level singletons.
- Keep controllers thin. Controllers should parse transport-level input and delegate to services/use cases.
- Keep business logic out of DTO classes.
- Use `async`/`await` consistently.
- Use explicit return DTOs for user-facing responses.
- Throw Nest exceptions with structured `{ code, message }` payloads when matching existing service style.

## auth-service Conventions

Architecture style:

```text
presentation → application/use-cases → domain (entities, ports) → infrastructure + integrations
```

- Controllers inject use cases directly — no `AppService` facade.
- `USER_REPOSITORY` / `REFRESH_TOKEN_REPOSITORY` for persistence; `OTP_STORE`, `EMAIL_OUTBOX`, `USER_PROFILE_CLIENT` for outbound integrations.
- HTTP request DTOs in `application/dto/auth-request.dto.ts`; use-case results in `application/dto/auth-use-case-results.ts`.
- ORM entities in `infrastructure/database/entities/*.orm-entity.ts` (`UserOrmEntity`, …).
- `ConfigurationService` centralizes environment/config reads.

Import style:

- Path alias `@/*` is used heavily.
- Preserve alias style in new auth-service files.

Config:

- Add new config through `env.config.ts` and `ConfigurationService`.
- Avoid scattered `process.env` reads in auth-service.
- Provide defaults only when safe for development.
- Required production secrets should fail clearly if missing.
- Production values live in **HashiCorp Vault** (synced via ESO to K8s `Secret`); local dev uses `.env` or Vault dev + `sync-env-from-vault` — see `infrastructure/vault/README.md`.

Security:

- Passwords use `scrypt` with per-password salt.
- JWT signing uses `jose` and HS256.
- OTP values are hashed before Redis storage.
- Login requires verified email.
- Refresh tokens should be random, persisted, rotated, and revocable.
- Never log passwords, raw OTPs, refresh tokens, or access tokens.

Outbox/email:

- Use existing outbox/Graphile Worker pattern for asynchronous email dispatch.
- Do not send email synchronously from request handlers if outbox path exists.

## user-service Conventions

Architecture style:

```text
presentation -> application -> domain repository port -> infrastructure repository
```

Layer rules:

- `presentation/http`: controllers and DTOs.
- Protected HTTP routes: `@UseGuards(AuthGuard)`; current user from `request.user.id`.
- `presentation/grpc`: gRPC controllers and protobuf mapping.
- `application/use-cases`: one class per user action/query where practical.
- `application/dto`: response DTO mapping functions.
- `domain/entities`: plain domain classes.
- `domain/repositories`: interfaces/tokens and input types.
- `infrastructure/database/entities`: TypeORM entities.
- `infrastructure/repositories`: persistence implementations.
- `integrations/auth`: auth-service gRPC client.

Repository rules:

- Keep `USER_PROFILE_REPOSITORY` as the application-facing dependency.
- Update both TypeORM and in-memory repository if behavior affects tests without DB.
- Keep domain entities free of TypeORM decorators.

Validation:

- Global `ValidationPipe` is configured in `app.setup.ts`.
- DTOs should use `class-validator` and `class-transformer`.
- Whitelist and forbid non-whitelisted input are enabled.
- Direct-port dev fallback `X-User-Id` is allowed only when `ALLOW_DEV_IDENTITY_HEADERS=true`.

## workspace-service Conventions

Architecture style:

```text
presentation/http -> application/use-cases -> domain repository ports <- infrastructure repositories
domain/events     -> event constants and payload types only
```

Layer rules:

- `presentation/http`: controllers, `AuthGuard`, `@UserId()` decorator, `internal-workspace.controller.ts`, filters.
- `application/use-cases/<area>/`: one class per action (`*.use-case.ts`, `execute()`).
- `application/dto/`: input DTOs with `class-validator`.
- `domain/repositories/`: port interfaces + Symbol tokens used by use cases.
- `infrastructure/database/entities/`: `*.orm-entity.ts` with snake_case columns.
- `infrastructure/repositories/`: TypeORM adapters; keep ORM access here.
- `domain/events/`: event types and payload contracts (Kafka topic mapping in `service-contracts.md`).

Rules:

- Use cases inject repository ports via `@Inject(SYMBOL)`; do not inject `Repository<OrmEntity>` directly.
- Transactions live in infrastructure adapters when multiple tables must commit together.
- Publish events only after successful persistence; include `eventId` and `occurredAt`.
- Port `8080`; global prefix `api/v1`.
- Full folder guide: `.claude/docs/service-architecture.md`.

## task-service Conventions

Architecture style:

```text
presentation/controllers -> CommandBus/QueryBus -> application/usecases/*.handler.ts
                         -> domain/entities -> application/ports -> infrastructure/repositories
```

Layer rules:

- `application/commands/` and `application/queries/`: CQRS message classes.
- `application/usecases/`: `@CommandHandler` / `@QueryHandler` implementations.
- `domain/entities/`: rich entities with factories and business methods.
- `infrastructure/persistence/`: Mongoose schemas; `infrastructure/mappers/` for mapping.
- `infrastructure/messaging/kafka/`: Kafka consumers (kafkajs) + DLQ publisher.

Rules:

- Register every new handler in `app.module.ts` `Handlers` array.
- Global prefix `api/v1`; controllers use `@Controller("tasks")`.
- Use double-quote style to match existing task-service files.
- Wrap HTTP responses with `presentation/common/response/` helpers where applicable.
- Protected routes: `@UseGuards(AuthGuard, WorkspaceValidationGuard)`; workspace S2S via Service JWT.
- Full folder guide: `.claude/docs/service-architecture.md`.

## notification-service Conventions

Architecture style:

```text
presentation/controllers/internal -> CommandBus -> application/usecases/<feature>/
                                                -> domain/entities -> infrastructure/database/
```

Layer rules:

- `application/usecases/<name>/`: co-locate `*.command.ts`, `*.handler.ts`, `*.query.ts` per feature folder.
- `domain/repositories/`: interfaces + injection tokens.
- `infrastructure/database/schemas/`: Mongoose schemas including `processed_events` for dedupe.
- `presentation/controllers/notifications.controller.ts`: HTTP list + health only unless expanded.

Rules:

- Pass `eventId` into `CreateNotificationCommand`; handler must dedupe via `ProcessedEventRepository`.
- Commit Kafka consumer offset only after successful handler execution (or DLQ publish).
- Global prefix `api/v1`; controller `notifications`.
- Protected list/read routes: `@UseGuards(AuthGuard)`; recipient from `request.user.id`.
- Full folder guide: `.claude/docs/service-architecture.md`.

## DTO and API Conventions

Request DTOs:

- Trim strings when current DTO/helper patterns do.
- Validate IDs and arrays.
- Use pagination defaults consistently: current user list defaults to `limit=20`, `offset=0`.
- Avoid accepting user identity in body when it should come from bearer token.

Response DTOs:

- Use explicit mapper functions like `toUserProfileResponseDto`.
- Do not return TypeORM entities directly.
- Keep field names stable and frontend-friendly.

Errors:

- Prefer stable machine-readable `code` values.
- Common examples:
  - `TOKEN_MISSING`
  - `TOKEN_INVALID`
  - `TOKEN_EXPIRED`
  - `USER_NOT_FOUND`
  - `USER_ALREADY_EXISTS`
  - `EMAIL_NOT_VERIFIED`
  - `EMAIL_VERIFICATION_OTP_INVALID`
  - `PASSWORD_INVALID`

## TypeORM Conventions

- Keep ORM entities under infrastructure/module-specific `entities`.
- Use migrations for schema changes.
- Avoid `synchronize: true` for real environments.
- **Migration file naming** (auth-service, user-service, workspace-service — TypeORM class migrations):
  - File: `{timestamp}-{PascalCase}.ts` (e.g. `1718000000001-CreateAuthOutboxEvents.ts`).
  - Class + `name`: `{PascalCase}{timestamp}` (e.g. `CreateAuthOutboxEvents1718000000001`).
  - Timestamp must be 13-digit JS milliseconds — required for `runMigrations()` on k3s.
  - Never use `001-foo.ts` / `CreateFoo001` (TypeORM rejects on deploy).
  - Location: `services/<service>/migrations/*.ts` (service root, not under `src/`).
  - Runner: `@collabspace/typeorm-migrate` via `src/migrate.ts`; `migrationsTransactionMode: 'each'`.
  - `CREATE INDEX CONCURRENTLY`: set `transaction = false` on the migration class.
  - Create: `./scripts/typeorm-migrate/create-migration.sh <auth|user|workspace> <Name>`
  - Revert last: `./scripts/typeorm-migrate/revert-migration.sh <auth|user|workspace>` or `pnpm run migrate:revert` in service.
  - Agent skill detail: `.claude/skills/nest-service-change/SKILL.md` → Schema Change Checklist.
- When adding columns:
  - Update migration.
  - Update ORM entity.
  - Update repository mapping.
  - Update DTO if exposed.
  - Update seed data if useful for demo.

## gRPC and Proto Conventions

- Proto files live under each service's `proto` directory.
- Generated TypeScript lives under `src/generated/proto` where present.
- When proto changes:
  - Update provider controller.
  - Update consumer service.
  - Regenerate TypeScript if the service has a generator script.
  - Update tests.
  - Update `.claude/docs/service-contracts.md`.

Auth/user package names:

- Auth package: `auth`
- User package: `user`

## Kafka / Event Conventions

- Publish domain events only via **transactional outbox** (same DB transaction as business write); Debezium CDC publishes to Kafka — do not publish directly from app after commit.
- Include idempotency key `eventId`.
- Include `occurredAt`.
- Include `eventType`.
- Prefer event types / topics already documented in `.claude/docs/service-contracts.md`:
  - `task_assigned` → `collabspace.task.task_assigned`
  - `workspace_invited` → `collabspace.workspace.workspace_invited`
  - `workspace_deleted` → `collabspace.workspace.workspace_deleted`
  - `comment_created` → `collabspace.task.comment_created`
  - `comment_mentioned` → `collabspace.task.comment_mentioned`
  - `user_registered` → `collabspace.user.user_registered`
  - `user_profile_updated` → `collabspace.user.user_profile_updated`
- Consumers should dedupe repeated events (`eventId`).
- Consumers should tolerate unknown event fields.
- Failed messages: retry with backoff → DLQ topic `collabspace.dlq.events` (see `infrastructure/kafka/README.md`).

## Health Check Conventions

Implemented services expose:

- `/health`
- `/health/live`
- `/health/ready`

With global prefix for NestJS services:

- `/api/v1/auth/health`
- `/api/v1/users/health`

Rules:

- Liveness should be cheap and not require dependencies.
- Readiness should check required dependencies.
- Startup logs should summarize readiness checks.

## Testing Conventions

Unit tests:

- Place `*.spec.ts` next to the unit under `src`.
- Mock external integrations.
- Test success, validation failure, not found, conflict, and auth failure paths.

E2E tests:

- Place under `test`.
- Use app setup matching production bootstrap where possible.
- Cover validation pipes and global prefixes.

Repository tests:

- In-memory tests are useful for use-case behavior.
- TypeORM persistence needs DB-backed tests when schema/query behavior matters.

## Documentation Conventions

Update docs when changing:

- Public HTTP route.
- gRPC proto/service contract.
- Event payload/routing key.
- Docker port or service name.
- Env var.
- Migration or seed assumptions.
- MVP status.

Docs to consider:

- `README.md`
- `docs/mvp-demo-scope.md`
- `.claude/docs/*`
- service-specific README if updated from starter template.

## Implementation Cautions

- Do not assume `workspace-service`, `task-service`, or `notification-service` are production-ready just because Dockerfiles exist.
- Do not call workspace-service on port `3000`; it is expected to run on `8080`.
- Do not add root-level package scripts unless intentionally creating a monorepo package setup.
- Do not let clients supply `userId` for current-user actions.
- Do not trust raw identity headers from public clients.
- Do not bypass auth-service verification for protected downstream service endpoints.

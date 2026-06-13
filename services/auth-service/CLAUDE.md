# auth-service

NestJS 11 + TypeORM + PostgreSQL + Redis + gRPC + Graphile Worker outbox.

## Pattern — clean / hexagonal (Phase 4 complete)

```text
presentation/http|grpc → application/use-cases → domain (entities, repositories, ports)
  → infrastructure/repositories | database | redis | outbox | emails | graphile-worker
  → integrations/user-profiles (gRPC client)
```

- `USER_REPOSITORY` / `REFRESH_TOKEN_REPOSITORY` — inject in use cases.
- `OTP_STORE` / `EMAIL_OUTBOX` / `USER_PROFILE_CLIENT` — outbound ports; adapters in `infrastructure/` and `integrations/`.
- `User` entity (`domain/entities/user.entity.ts`) — `assertCanLogin()` for email-verified + active checks.
- Controllers inject use cases directly — no `AppService` facade.

## Layout

```text
src/
├── presentation/http/auth.controller.ts
├── presentation/grpc/auth.grpc.controller.ts
├── application/use-cases/
├── application/services/
├── domain/
│   ├── entities/user.entity.ts
│   ├── repositories/         # USER_REPOSITORY, REFRESH_TOKEN_REPOSITORY
│   └── ports/                # OTP_STORE, EMAIL_OUTBOX, USER_PROFILE_CLIENT
├── infrastructure/
│   ├── repositories/         # typeorm-*, in-memory-user
│   ├── database/             # TypeORM root + DatabaseService
│   ├── identity/             # user/role ORM entities module
│   ├── refresh-tokens/       # refresh token ORM entities
│   ├── redis/                # RedisService + RedisOtpStoreAdapter
│   ├── outbox/               # AuthOutboxService + TypeOrmEmailOutboxAdapter
│   ├── emails/
│   └── graphile-worker/
├── integrations/user-profiles/   # UserProfilesGrpcService → USER_PROFILE_CLIENT
└── configuration/ | health/ | metrics/
```

## Commands

```sh
pnpm install
pnpm run proto:gen   # after proto changes
pnpm run build
pnpm run test
pnpm run test:e2e
pnpm run migrate
pnpm run seed
```

## Conventions

- Config via `ConfigurationService` only.
- Path alias `@/*` → `src/*`.
- Global prefix `/api/v1`; routes under `/auth/*`.
- New auth flow → add `application/use-cases/<action>.use-case.ts`; wire in `app.module.ts`.

## Integration

- Calls `user-service` gRPC `CreatePendingProfile` on register via `USER_PROFILE_CLIENT`.
- Hydrates profile via `GetProfile` for `/me` and verify flows.

## Where to add code

| Task | Path |
|------|------|
| New HTTP route | `presentation/http/auth.controller.ts` |
| New auth action | `application/use-cases/<action>.use-case.ts` |
| Shared JWT/session/OTP | `application/services/` |
| Domain login rules | `domain/entities/user.entity.ts` |
| User/role/password DB | `infrastructure/repositories/typeorm-user.repository.ts` (port: `domain/repositories/user.repository.ts`) |
| Refresh token behavior | `infrastructure/repositories/typeorm-refresh-token.repository.ts` |
| OTP storage port | `domain/ports/otp-store.port.ts` → `infrastructure/redis/redis-otp-store.adapter.ts` |
| Email outbox port | `domain/ports/email-outbox.port.ts` → `infrastructure/outbox/typeorm-email-outbox.adapter.ts` |
| User-service gRPC | `integrations/user-profiles/` |
| gRPC for downstream | `presentation/grpc/auth.grpc.controller.ts` |
| Config | `configuration/` |

Deep docs: `@../../.claude/docs/service-architecture.md` (auth section), `@../../.claude/docs/coding-conventions.md`, `@../../.claude/docs/service-contracts.md`

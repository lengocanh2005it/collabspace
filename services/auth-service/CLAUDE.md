# auth-service

NestJS 11 + TypeORM + PostgreSQL + Redis + gRPC + Graphile Worker outbox.

## Pattern (Phase 1–3 — migrating to clean/hexagonal)

**In progress:** presentation → application/use-cases → domain (entities/ports) → infrastructure adapters + integrations.

```text
presentation/http|grpc → application/use-cases → domain (entities, repositories, ports)
  → infrastructure/repositories | redis | outbox adapters
  → integrations/user-profiles (gRPC client)
modules/* (redis, outbox, emails, identity entities) — legacy until Phase 4
```

- `USER_REPOSITORY` / `REFRESH_TOKEN_REPOSITORY` — inject in use cases.
- `OTP_STORE` / `EMAIL_OUTBOX` / `USER_PROFILE_CLIENT` — outbound ports; adapters in `infrastructure/` and `integrations/`.
- `User` entity (`domain/entities/user.entity.ts`) — `assertCanLogin()` for email-verified + active checks.
- `AuthService` (`app.service.ts`) — thin facade for e2e/tests; remove in Phase 4.

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
│   ├── redis/                # RedisOtpStoreAdapter
│   └── outbox/               # TypeOrmEmailOutboxAdapter
├── integrations/user-profiles/   # UserProfilesGrpcService → USER_PROFILE_CLIENT
├── modules/identity/         # TypeORM entities only
├── modules/refresh-tokens/   # ORM entity module only
├── modules/redis/ | outbox/ | emails/
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

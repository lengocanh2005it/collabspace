# auth-service

NestJS 11 + TypeORM + PostgreSQL + Redis + gRPC + Graphile Worker outbox.

## Pattern — clean / hexagonal

```text
presentation/http|grpc → application/use-cases → domain (entities, repositories, ports)
  → infrastructure/repositories | database/entities | redis | outbox | emails | graphile-worker
  → integrations/user-profiles (gRPC client)
```

- `USER_REPOSITORY` / `REFRESH_TOKEN_REPOSITORY` — inject in use cases.
- `OTP_STORE` / `EMAIL_OUTBOX` / `USER_PROFILE_CLIENT` — outbound ports; adapters in `infrastructure/` and `integrations/`.
- HTTP request DTOs: `application/dto/auth-request.dto.ts`; use-case result types: `application/dto/auth-use-case-results.ts`.
- Domain model: `domain/entities/auth-user.ts`, `domain/entities/user.entity.ts` (login rules).
- ORM entities: `infrastructure/database/entities/*.orm-entity.ts` (`UserOrmEntity`, …).

## Layout

```text
src/
├── presentation/http/auth.controller.ts
├── presentation/grpc/auth.grpc.controller.ts
├── application/
│   ├── use-cases/
│   ├── services/
│   └── dto/                    # request + response + use-case result types
├── domain/
│   ├── entities/
│   ├── types/                  # jwt, login/register inputs, refresh-token
│   ├── repositories/
│   └── ports/
├── infrastructure/
│   ├── repositories/
│   ├── database/entities/      # *.orm-entity.ts
│   ├── identity/               # TypeORM feature module (users/roles)
│   ├── refresh-tokens/
│   ├── redis/
│   ├── outbox/
│   ├── emails/
│   └── graphile-worker/
├── integrations/user-profiles/
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
- Dev OTP endpoint uses `EMAIL_OUTBOX.getDevOtp()` — not `AuthOutboxService` in controllers.
- **TypeORM migrations** (`migrations/`): file `{timestamp}-{PascalCase}.ts`, class + `name` `{PascalCase}{timestamp}` — cùng quy ước `workspace-service` (vd. `1718000000001-CreateAuthOutboxEvents.ts` → `CreateAuthOutboxEvents1718000000001`). Không dùng prefix `001-` (TypeORM k8s sẽ reject).

## Integration

- Calls `user-service` gRPC `CreatePendingProfile` on register via `USER_PROFILE_CLIENT`.
- Hydrates profile via `GetProfile` for `/me` and verify flows.

## Where to add code

| Task | Path |
|------|------|
| New HTTP route | `presentation/http/auth.controller.ts` |
| New auth action | `application/use-cases/<action>.use-case.ts` |
| HTTP request DTO | `application/dto/auth-request.dto.ts` |
| Shared JWT/session/OTP | `application/services/` |
| Domain login rules | `domain/entities/user.entity.ts` |
| Auth user shape | `domain/entities/auth-user.ts` |
| User/role/password DB | `infrastructure/repositories/typeorm-user.repository.ts` |
| TypeORM entity | `infrastructure/database/entities/*.orm-entity.ts` |
| User-service gRPC | `integrations/user-profiles/` |

Deep docs: `@../../.claude/docs/service-architecture.md` (auth section), `@../../.claude/docs/coding-conventions.md`, `@../../.claude/docs/service-contracts.md`

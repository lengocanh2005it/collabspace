# auth-service

NestJS 11 + TypeORM + PostgreSQL + Redis + gRPC + Graphile Worker outbox.

## Pattern (Phase 1–2 — migrating to clean/hexagonal)

**In progress:** presentation → application/use-cases → domain/ports → infrastructure adapters.

```text
presentation/http|grpc → application/use-cases → domain/repositories (ports)
  → infrastructure/repositories (TypeORM + in-memory user repo)
modules/* (redis, outbox, emails) — legacy until Phase 4
```

- `USER_REPOSITORY` / `REFRESH_TOKEN_REPOSITORY` — inject ports in use cases, not `IdentityService`.
- `AuthService` (`app.service.ts`) — thin facade for e2e/tests; remove in Phase 4.

## Layout

```text
src/
├── presentation/http/auth.controller.ts
├── presentation/grpc/auth.grpc.controller.ts
├── application/use-cases/
├── application/services/
├── domain/repositories/            # USER_REPOSITORY, REFRESH_TOKEN_REPOSITORY ports
├── infrastructure/repositories/    # typeorm-*, in-memory-user
├── modules/identity/               # entities + user-profiles gRPC only
├── modules/refresh-tokens/         # ORM entity module only
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

- Calls `user-service` gRPC `CreatePendingProfile` on register.
- Hydrates profile via `GetProfile` for `/me` and verify flows.

## Where to add code

| Task | Path |
|------|------|
| New HTTP route | `presentation/http/auth.controller.ts` |
| New auth action | `application/use-cases/<action>.use-case.ts` |
| Shared JWT/session/OTP | `application/services/` |
| User/role/password DB | `infrastructure/repositories/typeorm-user.repository.ts` (port: `domain/repositories/user.repository.ts`) |
| Refresh token behavior | `infrastructure/repositories/typeorm-refresh-token.repository.ts` |
| Redis OTP | `modules/redis/` |
| Async email | `modules/outbox/` |
| gRPC for downstream | `presentation/grpc/auth.grpc.controller.ts` |
| Config | `configuration/` |

Deep docs: `@../../.claude/docs/service-architecture.md` (auth section), `@../../.claude/docs/coding-conventions.md`, `@../../.claude/docs/service-contracts.md`

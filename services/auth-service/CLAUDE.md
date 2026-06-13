# auth-service

NestJS 11 + TypeORM + PostgreSQL + Redis + gRPC + Graphile Worker outbox.

## Pattern (Phase 1 — migrating to clean/hexagonal)

**In progress:** presentation → application/use-cases → modules (DB layer unchanged until Phase 2+).

```text
presentation/http|grpc → application/use-cases → application/services
  → modules/* (identity, refresh-tokens, redis, outbox) — legacy until Phase 4
```

- `AuthService` (`app.service.ts`) — thin facade for e2e/tests; controllers use use cases directly.
- Remove facade in Phase 4.

## Layout

```text
src/
├── presentation/http/auth.controller.ts
├── presentation/grpc/auth.grpc.controller.ts
├── application/use-cases/          # one class per auth action
├── application/services/           # JwtToken, SessionIssuance, EmailOtp, ProfileResolver
├── application/dto/
├── modules/identity/               # users, roles, passwords (Phase 2+ → infrastructure)
├── modules/refresh-tokens/
├── modules/redis/
├── modules/outbox/
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
| User/role/password DB | `modules/identity/` (until Phase 2 ports) |
| Refresh token behavior | `modules/refresh-tokens/` |
| Redis OTP | `modules/redis/` |
| Async email | `modules/outbox/` |
| gRPC for downstream | `presentation/grpc/auth.grpc.controller.ts` |
| Config | `configuration/` |

Deep docs: `@../../.claude/docs/service-architecture.md` (auth section), `@../../.claude/docs/coding-conventions.md`, `@../../.claude/docs/service-contracts.md`

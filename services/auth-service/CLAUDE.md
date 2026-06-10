# auth-service

NestJS 11 + TypeORM + PostgreSQL + Redis + gRPC + Graphile Worker outbox.

## Layout

- `src/modules/identity/*` — users, roles, passwords
- `src/modules/refresh-tokens/*` — refresh token lifecycle
- `src/modules/redis/*` — OTP and session state
- `src/modules/outbox/*` — async email events
- `src/app.service.ts` — auth orchestration
- `src/auth.grpc.controller.ts` — `VerifyAccessToken` for downstream services

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

## Integration

- Calls `user-service` gRPC `CreatePendingProfile` on register.
- Hydrates profile via `GetProfile` for `/me` and verify flows.

Deep docs: `@../../.claude/docs/coding-conventions.md`, `@../../.claude/docs/service-contracts.md`

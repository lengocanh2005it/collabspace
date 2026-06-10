# user-service

NestJS 11 + TypeORM + PostgreSQL + gRPC server/client.

## Layout

```text
presentation/http          → REST controllers, request DTOs
presentation/grpc          → UserProfiles gRPC
application/use-cases      → one class per action
domain/entities            → plain domain models
domain/repositories        → ports (USER_PROFILE_REPOSITORY)
infrastructure/repositories → TypeORM + in-memory
integrations/auth          → auth-service gRPC client
```

## Commands

```sh
pnpm install
pnpm run build
pnpm run test
pnpm run test:e2e
pnpm run migrate
pnpm run seed
```

## Conventions

- Global prefix `/api/v1`; routes under `/users/*`.
- `me` endpoints resolve user from bearer token via auth gRPC.
- Return DTOs, never ORM entities.
- Without `DATABASE_URL`, in-memory repository is used (tests behave differently).

## Integration

- Verifies tokens through auth-service `VerifyAccessToken`.
- Serves profiles to auth-service and future task/workspace services.

Deep docs: `@../../.claude/docs/coding-conventions.md`, `@../../.claude/docs/service-contracts.md`

# user-service

NestJS 11 + TypeORM + PostgreSQL + gRPC server/client.

## Layout

```text
presentation/http          → REST controllers, request DTOs, AuthGuard
presentation/grpc          → UserProfiles gRPC
application/use-cases      → one class per action
domain/entities            → plain domain models
domain/repositories        → ports (USER_PROFILE_REPOSITORY)
infrastructure/repositories → TypeORM + in-memory
infrastructure/services    → AzureBlobService (avatar uploads)
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
- Protected HTTP routes use `AuthGuard` + auth gRPC (`VerifyAccessTokenLite`) and read the current user from `request.user.id`.
- Direct-port dev fallback `X-User-Id` is allowed only when `ALLOW_DEV_IDENTITY_HEADERS=true`.
- Return DTOs, never ORM entities.
- Without `DATABASE_URL`, in-memory repository is used (tests behave differently).

## Avatar upload

- `POST /api/v1/users/me/avatar` — multipart field `file` (`FileInterceptor`).
- `AzureBlobService` uploads to container `user-avatars` when `AZURE_STORAGE_CONNECTION_STRING` is set.
- Without connection string: mock mode returns `ui-avatars.com` URL (not persisted to blob).
- Updates profile via `UpdateUserProfileUseCase` (`avatarUrl`).

## Integration

- Verifies protected user routes through auth-service `VerifyAccessTokenLite`; platform admin routes use full verify through `PlatformAdminGuard`.
- Serves profiles to auth-service and task/workspace/notification services.

## Where to add code

| Task                | Path                                                                |
| ------------------- | ------------------------------------------------------------------- |
| HTTP route          | `presentation/http/`                                                |
| Use case            | `application/use-cases/*.use-case.ts`                               |
| Response DTO        | `application/dto/` + mapper                                         |
| Domain              | `domain/entities/`                                                  |
| Repository port     | `domain/repositories/`                                              |
| TypeORM             | `infrastructure/database/entities/`, `infrastructure/repositories/` |
| Blob / file storage | `infrastructure/services/azure-blob.service.ts`                     |

Deep docs: `@../../.claude/docs/service-architecture.md` (user section), `@../../.claude/docs/coding-conventions.md`, `@../../.claude/docs/service-contracts.md`

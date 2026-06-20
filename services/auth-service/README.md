# Auth Service

The Auth Service is the foundational identity and access management microservice for CollabSpace. It handles user registration, authentication, authorization (RBAC), and session management.

## Tech Stack
- **Framework:** NestJS
- **Database:** PostgreSQL (`collabspace_auth`) via TypeORM
- **Authentication:** JWT (JSON Web Tokens)
- **Messaging:** Outbox email (SMTP via Brevo) — no cross-service event bus
- **Containerization:** Docker (Alpine Node.js 20)

## Quick Start

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm run typeorm migration:run

# Seed initial data (Admin/Roles)
pnpm run seed

# Run in development mode
pnpm run start:dev

# Run tests
pnpm test
```

## Core Responsibilities

1. **Identity Provider:** Serves as the central authority for user credentials.
2. **Session Management:** Issues and revokes Access Tokens (short-lived) and Refresh Tokens (long-lived, rotatable).
3. **RBAC:** Manages Roles and Permissions. Injects `X-Role`, `X-Roles`, and `X-Permissions` into headers during validation.
4. **Token Validation:** Exposes a `/verify` endpoint used by Traefik's `ForwardAuth` middleware to authenticate all inbound requests.
5. **Profile Bootstrap:** Calls `user-service` over gRPC during registration to create the pending user profile; email verification is kept in auth state.

## Architecture

Clean/hexagonal (aligned with `user-service`):

```text
presentation → application/use-cases → domain → infrastructure + integrations
```

Key paths: `presentation/http/auth.controller.ts`, `application/use-cases/`, `domain/repositories/`, `infrastructure/database/entities/*.orm-entity.ts`, `integrations/user-profiles/`.

See `CLAUDE.md` and `.claude/docs/service-architecture.md` for agent conventions.

## API Endpoints

All endpoints are prefixed with `/api/v1/auth`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/health` | GET | Health check (no auth required) |
| `/api/v1/auth/register` | POST | Register a new user and generate an OTP |
| `/api/v1/auth/login` | POST | Authenticate and retrieve JWT tokens |
| `/api/v1/auth/refresh` | POST | Rotate refresh token |
| `/api/v1/auth/verify` | GET | Internal Traefik forward-auth validation endpoint |
| `/api/v1/auth/verify-email` | POST | Verify email via OTP |
| `/api/v1/auth/me` | GET | Get current authenticated user details |
| `/api/v1/auth/logout` | POST | Revoke current session |
| `/api/v1/auth/roles` | POST | Create a new role |
| `/api/v1/auth/permissions` | POST | Create a new permission |

## Internal Contracts
- **gRPC Server:** Exposes `AuthService.VerifyAccessToken` for downstream services requiring explicit identity checks outside of HTTP middleware.
- **gRPC Client:** Calls `UserProfilesService.CreatePendingProfile` on the `user-service` during registration to bootstrap the user's profile.

## Environment Variables

- `NODE_ENV`: Application environment (e.g., `production`, `development`)
- `PORT`: Service port (default: 3000)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT signing
- `JWT_EXPIRES_IN`: Access token expiration (e.g., `1h`)
- `JWT_REFRESH_EXPIRES_IN`: Refresh token expiration (e.g., `7d`)
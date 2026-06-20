# User Service

The User Service manages user profiles, preferences, and presence for CollabSpace. It is strictly separated from the Auth Service (which handles credentials) and resolves identities via logical references (`user_id`).

## Tech Stack
- **Framework:** NestJS
- **Database:** PostgreSQL (`collabspace_user`) via TypeORM
- **Messaging:** Outbox → Debezium → Kafka (`USER_OUTBOX_PUBLISH_MODE=debezium`)
- **Containerization:** Docker (Alpine Node.js 20)

## Quick Start

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm run typeorm migration:run

# Seed initial data (Demo Profiles)
pnpm run seed

# Run in development mode
pnpm run start:dev

# Run tests
pnpm test
```

## Core Responsibilities

1. **Profile Management:** Stores `full_name`, `avatar_url`, and `bio`.
2. **User Preferences:** Stores user-specific settings.
3. **Presence:** Tracks user status (`online`, `offline`, `away`) and custom status texts.
4. **Hydration Engine:** Serves bulk profile requests via HTTP and gRPC to hydrate UUIDs across other services (e.g., resolving `assigned_to` in the Task Service).

## API Endpoints

All endpoints are prefixed with `/api/v1/users`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/users/health` | GET | Health check (no auth required) |
| `/api/v1/users/me` | GET | Get current user's profile |
| `/api/v1/users/me` | PATCH | Update current user's profile |
| `/api/v1/users/me/preferences` | GET | Get current user's preferences |
| `/api/v1/users/me/status` | PATCH | Update user presence/status |
| `/api/v1/users/bulk` | POST | Fetch multiple profiles by `userIds` |
| `/api/v1/users/search` | GET | Search user profiles |
| `/api/v1/users/:id` | GET | Get full profile by ID |

## Internal Contracts
- **gRPC Server:** Exposes `UserProfilesService.CreatePendingProfile`, `GetProfile`, and `GetProfiles` for inter-service communication (primarily consumed by `auth-service`).
- **Kafka outbox (Debezium):** Emits `user_registered` and `user_profile_updated` via CDC.

## Environment Variables

- `NODE_ENV`: Application environment (e.g., `production`, `development`)
- `PORT`: Service port (default: 3000)
- `DATABASE_URL`: PostgreSQL connection string
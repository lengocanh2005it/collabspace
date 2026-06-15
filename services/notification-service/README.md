# Notification Service

The Notification Service consumes domain events asynchronously via RabbitMQ and persists notifications for HTTP list/read APIs.

## Tech Stack
- **Framework:** NestJS + CQRS
- **Database:** MongoDB (notifications, idempotency)
- **Messaging:** RabbitMQ (via amqplib)
- **Containerization:** Docker (Alpine Node.js 20)

## Quick Start

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm run start:dev

# Run tests
pnpm test
```

## Core Responsibilities

1. **Event Consumer:** Listens to the `collabspace_exchange` RabbitMQ direct exchange for cross-service events.
2. **Notification Persistence:** Stores notifications for `GET /api/v1/notifications` and mark-read.
3. **Real-time WebSockets:** **Not implemented yet.** Helm may expose `WS_ENABLED` / `WS_PATH` env vars for a future gateway route; clients should use HTTP polling until WS ships.

## API Endpoints

All HTTP endpoints are prefixed with `/api/v1/notifications`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/notifications/health` | GET | Health check (no auth required) |
| `/api/v1/notifications` | GET | Fetch notifications (paginated) |
| `/api/v1/notifications/:id/read` | PATCH | Mark a specific notification as read |

## Internal Contracts
- **RabbitMQ Consumer:** Listens to routing keys such as:
  - `task_assigned` (Published by `task-service`)
  - `workspace_invited` (Published by `workspace-service`)
  - `comment_created` (Published by `task-service`)

## Environment Variables

- `NODE_ENV`: Application environment (e.g., `production`, `development`)
- `PORT`: Service port (default: 3000)
- `AUTH_SERVICE_GRPC_URL`: Auth gRPC for JWT verification
- `SERVICE_JWT_SECRET`: Shared secret for service-to-service HTTP (required in production)
- `MONGO_URI`: MongoDB connection string
- `RABBITMQ_URL`: RabbitMQ connection string
- `WS_ENABLED`: Reserved for future WebSocket gateway (currently unused in code)

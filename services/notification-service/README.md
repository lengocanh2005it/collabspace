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

1. **Event Consumer:** Consumes the `notification-service` RabbitMQ queue for cross-service events.
2. **Notification Persistence:** Stores notifications for `GET /api/v1/notifications` and mark-read.
3. **Realtime notification stream:** `GET /api/v1/notifications/stream` exposes a server-sent events (SSE) stream for authenticated clients. `GET /api/v1/notifications` remains the source of truth; the stream is only an invalidation signal.

## API Endpoints

All HTTP endpoints are prefixed with `/api/v1/notifications`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/notifications/health` | GET | Health check (no auth required) |
| `/api/v1/notifications` | GET | Fetch notifications (paginated) |
| `/api/v1/notifications/stream` | GET | SSE stream for realtime invalidation events |
| `/api/v1/notifications/:id/read` | PATCH | Mark a specific notification as read |

## Internal Contracts
- **RabbitMQ Consumer:** Listens to routing keys such as:
  - `task_assigned` (Published by `task-service`)
  - `workspace_invited` (Published by `workspace-service`)
  - `workspace_deleted` (Published by `workspace-service`)
  - `comment_created` (Published by `task-service`)
  - `comment_mentioned` (Published by `task-service`)
  - `user_registered` / `user_profile_updated` (Published by `user-service`)

## Environment Variables

- `NODE_ENV`: Application environment (e.g., `production`, `development`)
- `PORT`: Service port (default: 3000)
- `AUTH_SERVICE_GRPC_URL`: Auth gRPC for JWT verification
- `SERVICE_JWT_SECRET`: Shared secret for service-to-service HTTP (required in production)
- `MONGO_URI`: MongoDB connection string
- `RABBITMQ_URL`: RabbitMQ connection string
- `WS_ENABLED`: Legacy placeholder from the earlier WebSocket plan; realtime now uses SSE and does not require a dedicated feature flag in code.

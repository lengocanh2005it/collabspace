# Notification Service

The Notification Service acts as the real-time event dispatcher for CollabSpace. It consumes domain events asynchronously via RabbitMQ and delivers them to users via WebSockets and persistent storage.

## Tech Stack
- **Framework:** NestJS
- **Database/Cache:** Redis / MongoDB
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
2. **Real-time Delivery:** Pushes events directly to connected clients via WebSockets (`/notifications/ws`).
3. **Notification Persistence:** Stores historical notifications to ensure delivery even when clients are offline.

## API Endpoints

All HTTP endpoints are prefixed with `/api/v1/notifications`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/notifications/health` | GET | Health check (no auth required) |
| `/api/v1/notifications` | GET | Fetch unread notifications |
| `/api/v1/notifications/:id/read` | PATCH | Mark a specific notification as read |
| `/notifications/ws` | WS | WebSocket connection for real-time delivery |

## Internal Contracts
- **RabbitMQ Consumer:** Listens to the following routing keys:
  - `task_assigned` (Published by `task-service`)
  - `workspace_invited` (Published by `workspace-service`)
  - `comment_created` (Published by `task-service`)

## Environment Variables

- `NODE_ENV`: Application environment (e.g., `production`, `development`)
- `PORT`: Service port (default: 3000)
- `REDIS_HOST`: Redis instance host
- `REDIS_PORT`: Redis instance port
- `REDIS_PASSWORD`: Redis authentication password
- `MONGO_URI`: MongoDB connection string (if persisting past Redis eviction)
- `RABBITMQ_URL`: RabbitMQ connection string

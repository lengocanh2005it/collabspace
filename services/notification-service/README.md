# Notification Service

The Notification Service consumes domain events asynchronously via Kafka and persists notifications for HTTP list/read APIs.

## Tech Stack
- **Framework:** NestJS + CQRS
- **Database:** MongoDB (notifications, idempotency)
- **Messaging:** Kafka (kafkajs consumers + DLQ topic)
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

1. **Event Consumer:** Kafka consumer groups for workspace, user, and task events.
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
- **Kafka consumer topics:** `workspace_invited`, `workspace_deleted`, `task_assigned`, `comment_created`, `comment_mentioned`, `user_registered`, `user_profile_updated`.

## Environment Variables

- `NODE_ENV`: Application environment (e.g., `production`, `development`)
- `PORT`: Service port (default: 3000)
- `AUTH_SERVICE_GRPC_URL`: Auth gRPC for JWT verification
- `SERVICE_JWT_SECRET`: Shared secret for service-to-service HTTP (required in production)
- `MONGO_URI`: MongoDB connection string
- `KAFKA_CONSUMERS_ENABLED`, `KAFKA_BROKERS`, `KAFKA_DLQ_TOPIC`: Kafka consumer + DLQ (see `.env.example`)
- `WS_ENABLED`: Legacy placeholder from the earlier WebSocket plan; realtime now uses SSE and does not require a dedicated feature flag in code.

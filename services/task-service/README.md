# Task Service

The Task Service manages the core collaboration entities in CollabSpace: tasks, assignments, and comments. It utilizes a flexible schema database (MongoDB) to support rapidly evolving task metadata.

## Tech Stack
- **Framework:** NestJS
- **Database:** MongoDB (`collabspace_task`) via Mongoose
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
> **Note:** MongoDB schemas are automatically initialized upon the first write operation. No explicit database migrations are required for standard development.

## Core Responsibilities

1. **Task Management:** Create, update, and manage the lifecycle of tasks within workspaces.
2. **Comments:** Attach rich-text comments to tasks.
3. **Workspace Validation:** Dynamically validates workspace affiliations (currently simulating valid UUIDs via `WorkspaceMockService` for E2E flows until the gRPC client is finalized).
4. **Event Publisher:** Publishes critical workflow events to the `collabspace_exchange` RabbitMQ direct exchange to trigger notifications.

## API Endpoints

All endpoints are prefixed with `/api/v1/tasks`. Requests require an `X-User-Id` header (and optionally `X-Workspace-Id`) injected by the API Gateway.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/tasks/health` | GET | Health check (no auth required) |
| `/api/v1/tasks` | POST | Create a new task in a workspace |
| `/api/v1/tasks` | GET | List tasks (filtered by workspace) |
| `/api/v1/tasks/:id` | GET | Get detailed task information |
| `/api/v1/tasks/:id` | PATCH | Update task fields (status, assignee, etc.) |
| `/api/v1/tasks/:id/comments` | POST | Add a comment to a task |

## Internal Contracts
- **RabbitMQ Publisher:** 
  - Publishes `TASK_ASSIGNED` when a user is assigned to a task.
  - Publishes `COMMENT_CREATED` when a comment is added to a task.

## Environment Variables

- `NODE_ENV`: Application environment (e.g., `production`, `development`)
- `PORT`: Service port (default: 3000)
- `MONGO_URI`: MongoDB connection string (e.g., `mongodb://localhost:27017/collabspace_task?authSource=admin`)
- `RABBITMQ_URL`: RabbitMQ connection string

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
3. **Workspace Validation:** Validates workspace membership via `WorkspaceHttpClient` when `WORKSPACE_CLIENT_MODE=http` (required in production). Mock mode is development-only.
4. **Attachments:** Azure Blob when `AZURE_STORAGE_CONNECTION_STRING` is set; mock URLs in local dev only (production fails startup without storage).
5. **Event Publisher:** Publishes critical workflow events to the `notification-service` RabbitMQ queue to trigger notifications.

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
  - Publishes `task_assigned` when a user is assigned to a task.
  - Publishes `comment_created` when a comment is added to a task assignee.
  - Publishes `comment_mentioned` when a user is mentioned in a comment.
- **RabbitMQ Consumer:**
  - Consumes `workspace_deleted` to clean task projections for deleted workspaces.

## Environment Variables

- `NODE_ENV`: Application environment (e.g., `production`, `development`)
- `PORT`: Service port (default: 3000)
- `MONGO_URI`: MongoDB connection string (e.g. `mongodb://admin:password@localhost:27017/collabspace_task?authSource=admin&replicaSet=rs0`)
- `WORKSPACE_CLIENT_MODE`: `http` (production) or `mock` (local dev only)
- `WORKSPACE_SERVICE_URL`: Base URL for workspace internal HTTP API
- `SERVICE_JWT_SECRET`: Shared secret for service-to-service JWT (required in production)
- `AZURE_STORAGE_CONNECTION_STRING`: Blob storage for task attachments (required in production)

# Workspace Service

The Workspace Service is a core domain microservice for CollabSpace, responsible for managing workspaces, projects, memberships, and invitations.

## Tech Stack
- **Framework:** NestJS
- **Database:** PostgreSQL (via TypeORM)
- **Messaging:** RabbitMQ (via amqplib)
- **Containerization:** Docker (Alpine Node.js 20)

## Quick Start

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Run in development mode
pnpm run start:dev

# Run tests
pnpm test
```

## API Endpoints

All **public** endpoints are prefixed with `/api/v1` and require `Authorization: Bearer …` (auth gRPC) or dev `ALLOW_DEV_IDENTITY_HEADERS`.

Internal service-to-service routes under `/api/v1/workspaces/internal/*` require `X-Internal-Service-Token` (used by task-service for membership checks).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/workspaces/health` | GET | Health check (no auth required) |
| `/workspaces` | POST | Create a new workspace |
| `/workspaces` | GET | List user's workspaces |
| `/workspaces/:id` | GET | Get workspace details |
| `/workspaces/:id` | PATCH | Update a workspace |
| `/workspaces/:id/members` | GET | List members in a workspace |
| `/workspaces/:workspaceId/projects` | POST | Create a project |
| `/workspaces/:workspaceId/projects` | GET | List projects in workspace |
| `/workspaces/:workspaceId/projects/:id` | PATCH | Update a project |
| `/workspaces/:workspaceId/projects/:id` | DELETE | Soft delete a project |
| `/workspaces/:workspaceId/invite` | POST | Invite a member |
| `/invitations/:id/accept` | POST | Accept an invitation |
| `/invitations/:id/reject` | POST | Reject an invitation |

## Environment Variables

- `NODE_ENV`: Application environment (e.g., `production`, `development`)
- `PORT`: Service port (default: 8080)
- `DATABASE_URL`: PostgreSQL connection string
- `DATABASE_SCHEMA`: Schema to use (default: `public`)
- `DATABASE_LOGGING`: Enable TypeORM logging (`true`/`false`)
- `DATABASE_SYNCHRONIZE`: Auto-sync schema (`true`/`false`)
- `RABBITMQ_URL`: RabbitMQ connection string
- `JAEGER_ENDPOINT`: Endpoint for distributed tracing

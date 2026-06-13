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

All API requests require an `X-User-Id` header (usually injected by the API Gateway after Auth validation).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/workspaces/health` | GET | Health check (no auth required) |
| `/api/v1/workspaces` | POST | Create a new workspace |
| `/api/v1/workspaces` | GET | List user's workspaces |
| `/api/v1/workspaces/:id` | GET | Get workspace details |
| `/api/v1/workspaces/:id` | PATCH | Update a workspace |
| `/api/v1/workspaces/:id/members` | GET | List members in a workspace |
| `/api/v1/workspaces/:workspaceId/projects` | POST | Create a project |
| `/api/v1/workspaces/:workspaceId/projects` | GET | List projects in workspace |
| `/api/v1/workspaces/:workspaceId/projects/:id` | PATCH | Update a project |
| `/api/v1/workspaces/:workspaceId/projects/:id` | DELETE | Soft delete a project |
| `/api/v1/workspaces/:workspaceId/invite` | POST | Invite a member |
| `/api/v1/invitations/:id/accept` | POST | Accept an invitation |
| `/api/v1/invitations/:id/reject` | POST | Reject an invitation |

## Environment Variables

- `NODE_ENV`: Application environment (e.g., `production`, `development`)
- `PORT`: Service port (default: 8080)
- `DATABASE_URL`: PostgreSQL connection string
- `DATABASE_SCHEMA`: Schema to use (default: `public`)
- `DATABASE_LOGGING`: Enable TypeORM logging (`true`/`false`)
- `DATABASE_SYNCHRONIZE`: Auto-sync schema (`true`/`false`)
- `RABBITMQ_URL`: RabbitMQ connection string
- `JAEGER_ENDPOINT`: Endpoint for distributed tracing

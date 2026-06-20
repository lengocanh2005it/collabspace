# workspace-service — agent cheat sheet

NestJS + TypeORM + PostgreSQL + Kafka (Debezium CDC outbox). Port **8080** (not 3000).

## Layout

```text
src/
├── application/use-cases/workspace|project|invitation/
├── domain/entities/, domain/repositories/, domain/events/
├── infrastructure/
│   ├── database/entities/, repositories/
│   └── outbox/                          # workspace_outbox_events + processor (debezium mode)
├── presentation/http/
└── health/
```

Key paths:

```text
domain/events/                           # event types + payload contracts
infrastructure/outbox/                   # WorkspaceOutboxService, processor
```

## Conventions

- Global prefix `api/v1`; container port **8080**
- Public: `AuthGuard` + auth gRPC; dev `ALLOW_DEV_IDENTITY_HEADERS`
- Internal S2S: `GET /workspaces/internal/:id/membership` + Service JWT
- Outbox: `workspace_outbox_events` in same Postgres transaction as invite/delete
- Events reach Kafka via **Debezium** (not in-app publish): topics `collabspace.workspace.*`
- Include `eventId` + `occurredAt` on every outbox row

## Env (local)

```env
WORKSPACE_OUTBOX_PUBLISH_MODE=debezium
DATABASE_URL=...
SERVICE_JWT_SECRET=...
AUTH_SERVICE_GRPC_URL=...
```

Register connector after stack up: `scripts/register-workspace-outbox-connector.ps1`

See: `.claude/docs/service-architecture.md` → workspace-service, `.claude/docs/service-contracts.md` → events.

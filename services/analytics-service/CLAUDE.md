# analytics-service

NestJS + Mongoose (MongoDB) + Kafka consumer. Read-model service for admin dashboard analytics.

## Purpose

Consumes Kafka events from auth/workspace/task services → builds pre-aggregated read models in MongoDB → exposes HTTP API for admin dashboard. No gRPC, no outbound events.

## Folder Layout

```text
src/
  config/            ConfigurationModule + ConfigurationService
  health/            AnalyticsHealthService
  metrics/           MetricsService, metrics-access.ts
  analytics/
    controllers/     AnalyticsController (health, metrics, analytics routes)
    services/        AnalyticsService (PR3)
    repositories/    AnalyticsRepository (PR2)
    dto/             DTOs (PR3)
  consumers/         Kafka consumers (PR2)
  domain/
    platform-snapshot.schema.ts
    timeseries-daily.schema.ts
```

## Commands

```sh
pnpm install
pnpm run build
pnpm run test
```

**Swagger:** `http://localhost:3005/swagger` (Docker host port **3005**).

## Conventions

- Global prefix `api/v1`; `@Controller('analytics')` → `/api/v1/analytics`
- Health: `/api/v1/analytics/health/live`, `/api/v1/analytics/health/ready`
- Metrics: `/api/v1/analytics/metrics` (Bearer `METRICS_AUTH_TOKEN`)
- Auth: Bearer JWT through auth gRPC; `PlatformAdminGuard` requires `analytics.read`
- MongoDB db: `collabspace_analytics`
- Kafka consumer group: `analytics-service`
- No seed data — read model is built from Kafka events; bootstrap via `scripts/seed-analytics-snapshot.sh` (PR4)

## Where to add code (PRs)

| PR | Task | Path |
|----|------|------|
| PR2 | Kafka consumers | `src/consumers/` |
| PR2 | Repository with `$inc` upsert | `src/analytics/repositories/` |
| PR3 | Analytics HTTP routes | `src/analytics/controllers/analytics.controller.ts` |
| PR3 | DTOs + Swagger | `src/analytics/dto/` |
| PR4 | Infra, Helm, Traefik, FE migration | docs + helm values |

Deep docs: `docs/analytics-service.md`, `.claude/docs/service-architecture.md`

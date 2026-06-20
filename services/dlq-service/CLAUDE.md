# dlq-service — Agent Guide

Ops service quản lý Dead Letter Queue lifecycle cho CollabSpace.

## Folder Layout

```
src/
├── main.ts                        # bootstrap, Swagger, middleware
├── app.module.ts                  # root module
├── configuration/                 # ConfigurationService (Mongo, Kafka, Scheduler)
├── domain/
│   └── dlq-record.schema.ts      # Mongoose schema, DlqStatus, DlqErrorCategory enums
├── health/
│   └── dlq-health.service.ts     # liveness + readiness checks
├── metrics/
│   ├── metrics.module.ts
│   ├── metrics.service.ts        # Prometheus counters/gauges/histograms
│   ├── metrics-access.ts
│   └── register-metrics.middleware.ts
├── common/http/                   # request-id middleware
├── integrations/auth/             # AuthGrpcService + PlatformAdminGuard providers
├── observability/                 # tracing.ts + instrumentation.ts
└── presentation/controllers/
    ├── health.controller.ts       # GET /dlq/health/live, /dlq/health/ready
    └── metrics.controller.ts     # GET /dlq/metrics
```

## Key Facts

- Port: `3000`, global prefix: `/api/v1`
- MongoDB database: `collabspace_dlq`, collection: `dlq_records`
- Kafka topic consumed: `collabspace.dlq.events`
- Auth: Bearer JWT qua gateway → `PlatformAdminGuard` cho admin routes
- Permissions: `dlq.read` (view), `dlq.manage` (replay/discard/resolve)
- Không có gRPC outbound; không publish event mới

## Status Enum

```
pending → replaying → pending (retry) | requires_manual_review
requires_manual_review → resolved | discarded (admin)
```

`logic`/`schema` errorCategory → ingest thẳng `requires_manual_review`, không auto-retry.

## Spec đầy đủ

[docs/dlq-service.md](../../docs/dlq-service.md)

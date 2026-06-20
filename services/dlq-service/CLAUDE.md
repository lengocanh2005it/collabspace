# dlq-service — Agent Guide

Ops service quản lý Dead Letter Queue lifecycle cho CollabSpace.

## Folder Layout

```
src/
├── main.ts                        # bootstrap, Swagger, middleware
├── app.module.ts                  # root module
├── configuration/                 # ConfigurationService (Mongo, Kafka, Scheduler)
├── domain/
│   ├── dlq-record.schema.ts      # Mongoose schema, DlqStatus, DlqErrorCategory enums
│   └── dlq-record.repository.ts  # IDlqRecordRepository interface + types
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
├── infrastructure/
│   ├── kafka/
│   │   ├── dlq-events.consumer.ts   # Kafka consumer → ingest DLQ envelopes
│   │   └── dlq-replay.producer.ts   # Kafka producer → replay to source topic
│   └── mongo/
│       └── dlq-record.mongo.repository.ts  # MongoDlqRecordRepository
├── application/
│   ├── dlq-ingest.service.ts      # classify errorCategory → upsert snapshot
│   └── dlq-replay.service.ts      # replayOne/replayBatch/resolveOne/discardOne
├── scheduler/
│   └── dlq-auto-retry.scheduler.ts  # @Cron: auto-retry, stale lock cleanup, oldest age gauge
└── presentation/
    ├── controllers/
    │   ├── health.controller.ts       # GET /dlq/health/live, /dlq/health/ready
    │   ├── metrics.controller.ts      # GET /dlq/metrics
    │   ├── dlq-messages.controller.ts # GET /dlq/messages, GET /dlq/messages/:id
    │   └── dlq-actions.controller.ts  # POST replay/resolve/discard
    └── dto/
        ├── dlq-message-response.dto.ts
        ├── list-dlq-messages-query.dto.ts
        ├── replay-dlq-message.dto.ts
        ├── replay-batch-dlq.dto.ts
        └── resolve-discard-dlq.dto.ts
```

## Key Facts

- Port: `3000`, global prefix: `/api/v1`
- MongoDB database: `collabspace_dlq`, collection: `dlq_records`
- Kafka topic consumed: `collabspace.dlq.events`
- Kafka replay: re-publish về `record.sourceTopic` gốc với headers `x-dlq-replayed`, `x-dlq-record-id`, `x-replay-attempt`, `x-replayed-by`, `x-replayed-at`
- Auth: Bearer JWT qua gateway → `PlatformAdminGuard` cho admin routes
- Permissions: `dlq.read` (GET endpoints), `dlq.manage` (replay/resolve/discard)
- Không có gRPC outbound; không publish event mới ngoài replay

## Status Enum & State Machine

```
(ingest transient/unknown) → pending
(ingest logic/schema)      → requires_manual_review

pending → replaying (atomic lock) → pending (retry OK / Kafka fail + retries left)
                                  → requires_manual_review (Kafka fail + exhausted)

pending / requires_manual_review → replaying (admin POST /replay)
requires_manual_review → resolved (admin POST /resolve)
pending / requires_manual_review → discarded (admin POST /discard)
```

## Backoff Schedule

| Attempt (retryCount after fail) | nextRetryAt |
|----------------------------------|-------------|
| 1 | now + 5 min |
| 2 | now + 30 min |
| 3+ | now + 2 h |
| >= maxRetries | null → requires_manual_review |

## Scheduler Crons

| Cron | Method | Việc làm |
|------|--------|----------|
| `* * * * *` | `runAutoRetry` | replayBatch({statuses:['pending'], nextRetryAtBefore:now}) |
| `*/5 * * * *` | `cleanupStaleLocks` | reset `replaying` + lockedAt < now-5min → `pending` |
| `* * * * *` | `refreshOldestPendingAge` | set `dlqOldestPendingAgeSeconds` gauge |

## Prometheus Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `dlq_records_total` | Gauge | status, sourceTopic, errorCategory |
| `dlq_replay_attempts_total` | Counter | sourceTopic, trigger, result |
| `dlq_oldest_pending_age_seconds` | Gauge | — |
| `dlq_auto_retry_runs_total` | Counter | — |
| `dlq_auto_retry_batch_size` | Histogram | — |
| `dlq_consumer_events_ingested_total` | Counter | sourceTopic, errorCategory |

## Spec đầy đủ

[docs/dlq-service.md](../../docs/dlq-service.md)

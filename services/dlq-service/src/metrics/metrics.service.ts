import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  private readonly httpRequestsTotal: Counter<'method' | 'route' | 'status'>;
  private readonly httpRequestDurationSeconds: Histogram<'method' | 'route' | 'status'>;

  // DLQ-specific metrics
  readonly dlqRecordsTotal: Gauge<'status' | 'sourceTopic' | 'errorCategory'>;
  readonly dlqReplayAttemptsTotal: Counter<'sourceTopic' | 'trigger' | 'result'>;
  readonly dlqOldestPendingAgeSeconds: Gauge;
  readonly dlqAutoRetryRunsTotal: Counter;
  readonly dlqAutoRetryBatchSize: Histogram;
  readonly dlqConsumerEventsIngestedTotal: Counter<'sourceTopic' | 'errorCategory'>;

  constructor(serviceName: string) {
    this.registry.setDefaultLabels({ service: serviceName });
    collectDefaultMetrics({ register: this.registry, prefix: 'collabspace_' });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.dlqRecordsTotal = new Gauge({
      name: 'dlq_records_total',
      help: 'Number of DLQ records by status, sourceTopic, and errorCategory',
      labelNames: ['status', 'sourceTopic', 'errorCategory'],
      registers: [this.registry],
    });

    this.dlqReplayAttemptsTotal = new Counter({
      name: 'dlq_replay_attempts_total',
      help: 'Total DLQ replay attempts',
      labelNames: ['sourceTopic', 'trigger', 'result'],
      registers: [this.registry],
    });

    this.dlqOldestPendingAgeSeconds = new Gauge({
      name: 'dlq_oldest_pending_age_seconds',
      help: 'Age in seconds of the oldest pending DLQ record',
      registers: [this.registry],
    });

    this.dlqAutoRetryRunsTotal = new Counter({
      name: 'dlq_auto_retry_runs_total',
      help: 'Total auto-retry scheduler runs',
      registers: [this.registry],
    });

    this.dlqAutoRetryBatchSize = new Histogram({
      name: 'dlq_auto_retry_batch_size',
      help: 'Number of records processed per auto-retry run',
      buckets: [0, 1, 5, 10, 20, 50],
      registers: [this.registry],
    });

    this.dlqConsumerEventsIngestedTotal = new Counter({
      name: 'dlq_consumer_events_ingested_total',
      help: 'Total DLQ events ingested from Kafka',
      labelNames: ['sourceTopic', 'errorCategory'],
      registers: [this.registry],
    });
  }

  recordHttpRequest(method: string, route: string, status: number, durationSeconds: number): void {
    const labels = { method, route, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  getRegistry(): Registry {
    return this.registry;
  }
}

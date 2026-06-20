import { Inject, Injectable, Logger } from '@nestjs/common';
import type { KafkaDlqEnvelope } from '@collabspace/shared';
import { DLQ_RECORD_REPOSITORY, type IDlqRecordRepository } from '../domain/dlq-record.repository';
import type { DlqErrorCategory, DlqRecord, DlqStatus } from '../domain/dlq-record.schema';
import { ConfigurationService } from '../configuration/configuration.service';
import { MetricsService } from '../metrics/metrics.service';

type IngestResult = { record: DlqRecord; isNew: boolean };

@Injectable()
export class DlqIngestService {
  private readonly logger = new Logger(DlqIngestService.name);

  constructor(
    @Inject(DLQ_RECORD_REPOSITORY) private readonly repo: IDlqRecordRepository,
    private readonly config: ConfigurationService,
    private readonly metrics: MetricsService,
  ) {}

  async ingest(envelope: KafkaDlqEnvelope): Promise<IngestResult> {
    const category: DlqErrorCategory = envelope.errorCategory ?? 'unknown';
    const { status, maxRetries, nextRetryAt } = this.resolveInitialState(category);

    const record = await this.repo.upsertFromEnvelope({
      sourceTopic: envelope.sourceTopic,
      sourcePartition: envelope.partition,
      sourceOffset: envelope.offset,
      sourceKey: envelope.key ?? null,
      consumerGroup: envelope.consumerGroup ?? null,
      payload: envelope.payload as Record<string, unknown>,
      errorMessage: envelope.errorMessage,
      errorCategory: category,
      failedAt: new Date(envelope.failedAt),
      status,
      maxRetries,
      nextRetryAt,
    });

    this.metrics.dlqConsumerEventsIngestedTotal.inc({
      sourceTopic: envelope.sourceTopic,
      errorCategory: category,
    });

    this.logger.log(
      `DLQ ingest: topic=${envelope.sourceTopic} partition=${envelope.partition} offset=${envelope.offset} category=${category} status=${status}`,
    );

    return { record, isNew: true };
  }

  private resolveInitialState(category: DlqErrorCategory): {
    status: DlqStatus;
    maxRetries: number;
    nextRetryAt: Date | null;
  } {
    const schedulerConfig = this.config.getDlqSchedulerConfig();

    if (category === 'transient') {
      return {
        status: 'pending',
        maxRetries: schedulerConfig.maxRetriesTransient,
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
      };
    }

    if (category === 'unknown') {
      return {
        status: 'pending',
        maxRetries: schedulerConfig.maxRetriesUnknown,
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
      };
    }

    // logic | schema → skip auto-retry
    return {
      status: 'requires_manual_review',
      maxRetries: 0,
      nextRetryAt: null,
    };
  }
}

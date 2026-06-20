import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DlqReplayService } from '../application/dlq-replay.service';
import { DLQ_RECORD_REPOSITORY, type IDlqRecordRepository } from '../domain/dlq-record.repository';
import { ConfigurationService } from '../configuration/configuration.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class DlqAutoRetryScheduler {
  private readonly logger = new Logger(DlqAutoRetryScheduler.name);

  constructor(
    private readonly replayService: DlqReplayService,
    @Inject(DLQ_RECORD_REPOSITORY) private readonly repo: IDlqRecordRepository,
    private readonly config: ConfigurationService,
    private readonly metrics: MetricsService,
  ) {}

  @Cron('* * * * *')
  async runAutoRetry(): Promise<void> {
    const { autoRetryEnabled, batchSize } = this.config.getDlqSchedulerConfig();
    if (!autoRetryEnabled) return;

    this.metrics.dlqAutoRetryRunsTotal.inc();

    try {
      const outcomes = await this.replayService.replayBatch(
        {
          statuses: ['pending'],
          nextRetryAtBefore: new Date(),
          limit: batchSize,
        },
        'scheduler',
      );

      const produced = outcomes.filter((o) => o.produced).length;
      const skipped = outcomes.filter((o) => o.skipped).length;

      this.metrics.dlqAutoRetryBatchSize.observe(outcomes.length);

      if (outcomes.length > 0) {
        this.logger.log(
          `Auto-retry run: total=${outcomes.length} produced=${produced} skipped=${skipped}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Auto-retry scheduler error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  @Cron('*/5 * * * *')
  async cleanupStaleLocks(): Promise<void> {
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
    try {
      const count = await this.repo.releaseStaleLocks(staleThreshold);
      if (count > 0) {
        this.logger.warn(`Released ${count} stale DLQ replay lock(s) older than 5 minutes`);
      }
    } catch (err) {
      this.logger.error(
        `Stale lock cleanup error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  @Cron('* * * * *')
  async refreshOldestPendingAge(): Promise<void> {
    try {
      const oldest = await this.repo.findOldestPending();
      if (oldest) {
        const ageSeconds = (Date.now() - oldest.createdAt.getTime()) / 1000;
        this.metrics.dlqOldestPendingAgeSeconds.set(ageSeconds);
      } else {
        this.metrics.dlqOldestPendingAgeSeconds.set(0);
      }
    } catch (err) {
      this.logger.error(
        `Oldest pending age refresh error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

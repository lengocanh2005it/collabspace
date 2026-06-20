import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DLQ_RECORD_REPOSITORY,
  type FindForReplayFilter,
  type IDlqRecordRepository,
} from '../domain/dlq-record.repository';
import type { DlqErrorCategory, DlqRecord, DlqStatus } from '../domain/dlq-record.schema';
import { DlqReplayProducer } from '../infrastructure/kafka/dlq-replay.producer';
import { ConfigurationService } from '../configuration/configuration.service';
import { MetricsService } from '../metrics/metrics.service';

export type ReplayOutcome = {
  id?: string;
  record?: DlqRecord;
  produced: boolean;
  skipped: boolean;
  reason?: string;
};

export type BatchReplayFilter = {
  ids?: string[];
  sourceTopic?: string;
  errorCategory?: DlqErrorCategory;
  statuses?: DlqStatus[];
  nextRetryAtBefore?: Date;
  limit: number;
};

@Injectable()
export class DlqReplayService {
  private readonly logger = new Logger(DlqReplayService.name);

  constructor(
    @Inject(DLQ_RECORD_REPOSITORY) private readonly repo: IDlqRecordRepository,
    private readonly producer: DlqReplayProducer,
    private readonly config: ConfigurationService,
    private readonly metrics: MetricsService,
  ) {}

  async replayOne(id: string, triggeredBy: string): Promise<DlqRecord> {
    const locked = await this.repo.acquireLock(id, this.config.getInstanceId());
    if (!locked) {
      const existing = await this.repo.findById(id);
      if (!existing) throw new NotFoundException(`DLQ record not found: ${id}`);
      throw new ConflictException(
        `Record ${id} cannot be locked for replay (status=${existing.status}, lockedBy=${existing.lockedBy ?? 'none'})`,
      );
    }

    return this.executeReplay(locked as DlqRecord & { _id: { toString(): string } }, triggeredBy);
  }

  async replayBatch(filter: BatchReplayFilter, triggeredBy: string): Promise<ReplayOutcome[]> {
    const statuses: DlqStatus[] = filter.statuses ?? ['pending', 'requires_manual_review'];
    const replayFilter: FindForReplayFilter = {
      statuses,
      ids: filter.ids,
      sourceTopic: filter.sourceTopic,
      errorCategory: filter.errorCategory,
      nextRetryAtBefore: filter.nextRetryAtBefore,
      limit: Math.min(filter.limit, 50),
    };

    const candidates = await this.repo.findForReplay(replayFilter);
    const outcomes: ReplayOutcome[] = [];

    for (const candidate of candidates) {
      const id = String((candidate as DlqRecord & { _id: { toString(): string } })._id);
      const locked = await this.repo.acquireLock(id, this.config.getInstanceId());

      if (!locked) {
        outcomes.push({
          id,
          record: candidate,
          produced: false,
          skipped: true,
          reason: 'Already locked by another instance',
        });
        continue;
      }

      const result = await this.executeReplay(
        locked as DlqRecord & { _id: { toString(): string } },
        triggeredBy,
      );
      outcomes.push({ id, record: result, produced: true, skipped: false });
    }

    return outcomes;
  }

  async replayManyByIds(ids: string[], triggeredBy: string): Promise<ReplayOutcome[]> {
    const outcomes: ReplayOutcome[] = [];
    for (const id of ids) {
      try {
        const record = await this.replayOne(id, triggeredBy);
        outcomes.push({ id, record, produced: true, skipped: false });
      } catch (error) {
        outcomes.push({
          id,
          produced: false,
          skipped: true,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return outcomes;
  }

  async resolveOne(id: string, adminId: string, note: string): Promise<DlqRecord> {
    const updated = await this.repo.updateStatusByAdmin(id, 'resolved', adminId, note);
    if (!updated) throw new NotFoundException(`DLQ record not found or already discarded: ${id}`);
    this.logger.log(`DLQ record resolved: id=${id} by=${adminId}`);
    return updated;
  }

  async discardOne(id: string, adminId: string, note: string): Promise<DlqRecord> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`DLQ record not found: ${id}`);

    const updated = await this.repo.updateStatusByAdmin(id, 'discarded', adminId, note);
    if (!updated)
      throw new ConflictException(`Record ${id} could not be discarded (already discarded?)`);
    this.logger.log(`DLQ record discarded: id=${id} by=${adminId}`);
    return updated;
  }

  private calcBackoff(retryCount: number): Date {
    // attempt 1 → +5min, attempt 2 → +30min, attempt 3+ → +2h
    const delayMs =
      retryCount <= 1 ? 5 * 60 * 1000 : retryCount === 2 ? 30 * 60 * 1000 : 2 * 60 * 60 * 1000;
    return new Date(Date.now() + delayMs);
  }

  private async executeReplay(
    locked: DlqRecord & { _id: { toString(): string } },
    triggeredBy: string,
  ): Promise<DlqRecord> {
    const id = locked._id.toString();
    const attemptNumber = locked.retryCount + 1;

    try {
      await this.producer.produce({ record: locked, triggeredBy, attemptNumber });

      const nextRetryCount = locked.retryCount + 1;
      const nextStatus: DlqStatus = 'pending';

      const updated = await this.repo.releaseAfterReplay(id, {
        by: triggeredBy,
        action: triggeredBy === 'scheduler' ? 'auto_retry' : 'manual_replay',
        result: 'success',
        newRetryCount: nextRetryCount,
        nextStatus,
        nextRetryAt: null,
      });

      this.metrics.dlqReplayAttemptsTotal.inc({
        sourceTopic: locked.sourceTopic,
        trigger: triggeredBy === 'scheduler' ? 'auto' : 'manual',
        result: 'success',
      });

      return updated ?? locked;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const newRetryCount = locked.retryCount + 1;
      const exhausted = newRetryCount >= locked.maxRetries;

      const nextStatus: DlqStatus = exhausted ? 'requires_manual_review' : 'pending';
      const nextRetryAt = exhausted ? null : this.calcBackoff(newRetryCount);

      this.logger.error(
        `DLQ replay produce failed: id=${id} attempt=${attemptNumber} exhausted=${exhausted}: ${errorMessage}`,
      );

      const updated = await this.repo.releaseAfterReplay(id, {
        by: triggeredBy,
        action: triggeredBy === 'scheduler' ? 'auto_retry' : 'manual_replay',
        result: 'failure',
        errorMessage,
        newRetryCount,
        nextStatus,
        nextRetryAt,
      });

      this.metrics.dlqReplayAttemptsTotal.inc({
        sourceTopic: locked.sourceTopic,
        trigger: triggeredBy === 'scheduler' ? 'auto' : 'manual',
        result: 'failure',
      });

      return updated ?? locked;
    }
  }
}

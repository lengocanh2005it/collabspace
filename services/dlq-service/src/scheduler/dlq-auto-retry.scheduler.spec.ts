import { DlqAutoRetryScheduler } from './dlq-auto-retry.scheduler';
import type { DlqReplayService, ReplayOutcome } from '../application/dlq-replay.service';
import type { IDlqRecordRepository } from '../domain/dlq-record.repository';
import type { DlqRecord } from '../domain/dlq-record.schema';
import type { ConfigurationService } from '../configuration/configuration.service';
import type { MetricsService } from '../metrics/metrics.service';

const makeRecord = (overrides: Partial<DlqRecord> = {}): DlqRecord =>
  ({
    status: 'pending',
    sourceTopic: 'collabspace.task.events',
    createdAt: new Date(Date.now() - 60_000),
    ...overrides,
  }) as unknown as DlqRecord;

const makeOutcome = (produced: boolean, skipped = false): ReplayOutcome => ({
  record: makeRecord(),
  produced,
  skipped,
});

describe('DlqAutoRetryScheduler', () => {
  let scheduler: DlqAutoRetryScheduler;
  let replayService: jest.Mocked<Pick<DlqReplayService, 'replayBatch'>>;
  let repo: jest.Mocked<Pick<IDlqRecordRepository, 'releaseStaleLocks' | 'findOldestPending'>>;
  let config: { getDlqSchedulerConfig: jest.Mock };
  let metrics: {
    dlqAutoRetryRunsTotal: { inc: jest.Mock };
    dlqAutoRetryBatchSize: { observe: jest.Mock };
    dlqOldestPendingAgeSeconds: { set: jest.Mock };
  };

  beforeEach(() => {
    replayService = { replayBatch: jest.fn() };
    repo = {
      releaseStaleLocks: jest.fn().mockResolvedValue(0),
      findOldestPending: jest.fn().mockResolvedValue(null),
    };
    config = {
      getDlqSchedulerConfig: jest.fn().mockReturnValue({
        autoRetryEnabled: true,
        batchSize: 10,
        maxRetriesTransient: 3,
        maxRetriesUnknown: 1,
      }),
    };
    metrics = {
      dlqAutoRetryRunsTotal: { inc: jest.fn() },
      dlqAutoRetryBatchSize: { observe: jest.fn() },
      dlqOldestPendingAgeSeconds: { set: jest.fn() },
    };

    scheduler = new DlqAutoRetryScheduler(
      replayService,
      repo,
      config as unknown as ConfigurationService,
      metrics as unknown as MetricsService,
    );
  });

  describe('runAutoRetry', () => {
    it('skips when autoRetryEnabled=false', async () => {
      config.getDlqSchedulerConfig.mockReturnValue({ autoRetryEnabled: false, batchSize: 10 });
      await scheduler.runAutoRetry();
      expect(replayService.replayBatch).not.toHaveBeenCalled();
    });

    it('calls replayBatch with pending status and nextRetryAtBefore=now', async () => {
      replayService.replayBatch.mockResolvedValue([makeOutcome(true)]);
      await scheduler.runAutoRetry();

      const [filter, triggeredBy] = replayService.replayBatch.mock.calls[0];
      expect(triggeredBy).toBe('scheduler');
      expect(filter.statuses).toEqual(['pending']);
      expect(filter.nextRetryAtBefore).toBeInstanceOf(Date);
      expect(filter.limit).toBe(10);
    });

    it('increments dlqAutoRetryRunsTotal on each run', async () => {
      replayService.replayBatch.mockResolvedValue([]);
      await scheduler.runAutoRetry();
      expect(metrics.dlqAutoRetryRunsTotal.inc).toHaveBeenCalledTimes(1);
    });

    it('records batch size in histogram', async () => {
      replayService.replayBatch.mockResolvedValue([makeOutcome(true), makeOutcome(false, true)]);
      await scheduler.runAutoRetry();
      expect(metrics.dlqAutoRetryBatchSize.observe).toHaveBeenCalledWith(2);
    });

    it('does not throw when replayBatch rejects', async () => {
      replayService.replayBatch.mockRejectedValue(new Error('Kafka down'));
      await expect(scheduler.runAutoRetry()).resolves.toBeUndefined();
    });
  });

  describe('cleanupStaleLocks', () => {
    it('calls releaseStaleLocks with threshold 5 minutes ago', async () => {
      const before = Date.now();
      await scheduler.cleanupStaleLocks();
      const after = Date.now();

      const [lockedBefore] = repo.releaseStaleLocks.mock.calls[0];
      const thresholdMs = lockedBefore.getTime();
      expect(thresholdMs).toBeGreaterThanOrEqual(before - 5 * 60 * 1000 - 100);
      expect(thresholdMs).toBeLessThanOrEqual(after - 5 * 60 * 1000 + 100);
    });

    it('does not throw when releaseStaleLocks rejects', async () => {
      repo.releaseStaleLocks.mockRejectedValue(new Error('mongo timeout'));
      await expect(scheduler.cleanupStaleLocks()).resolves.toBeUndefined();
    });
  });

  describe('refreshOldestPendingAge', () => {
    it('sets gauge to 0 when no pending records', async () => {
      repo.findOldestPending.mockResolvedValue(null);
      await scheduler.refreshOldestPendingAge();
      expect(metrics.dlqOldestPendingAgeSeconds.set).toHaveBeenCalledWith(0);
    });

    it('sets gauge to age in seconds of oldest pending record', async () => {
      const createdAt = new Date(Date.now() - 120_000);
      repo.findOldestPending.mockResolvedValue(makeRecord({ createdAt }));
      await scheduler.refreshOldestPendingAge();

      const [age] = metrics.dlqOldestPendingAgeSeconds.set.mock.calls[0];
      expect(age).toBeGreaterThanOrEqual(119);
      expect(age).toBeLessThanOrEqual(122);
    });

    it('does not throw when findOldestPending rejects', async () => {
      repo.findOldestPending.mockRejectedValue(new Error('mongo timeout'));
      await expect(scheduler.refreshOldestPendingAge()).resolves.toBeUndefined();
    });
  });
});

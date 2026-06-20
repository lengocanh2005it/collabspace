import { ConflictException, NotFoundException } from '@nestjs/common';
import { DlqReplayService } from './dlq-replay.service';
import type { IDlqRecordRepository } from '../domain/dlq-record.repository';
import type { DlqRecord } from '../domain/dlq-record.schema';
import type { DlqReplayProducer } from '../infrastructure/kafka/dlq-replay.producer';
import type { ConfigurationService } from '../configuration/configuration.service';
import type { MetricsService } from '../metrics/metrics.service';

const baseRecord = (
  overrides: Partial<DlqRecord & { _id: { toString(): string } }> = {},
): DlqRecord & { _id: { toString(): string } } =>
  ({
    _id: { toString: () => 'record-id-001' },
    sourceTopic: 'collabspace.task.events',
    sourcePartition: 0,
    sourceOffset: '42',
    sourceKey: null,
    consumerGroup: null,
    payload: { id: 'task-1' },
    errorMessage: 'err',
    errorCategory: 'transient',
    failedAt: new Date(),
    status: 'pending',
    retryCount: 0,
    maxRetries: 3,
    nextRetryAt: new Date(),
    lastRetriedAt: null,
    replayedBy: null,
    resolvedBy: null,
    discardedBy: null,
    resolutionNote: null,
    retryHistory: [],
    lockedAt: null,
    lockedBy: null,
    lockedFromStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as DlqRecord & { _id: { toString(): string } };

describe('DlqReplayService', () => {
  let service: DlqReplayService;
  let repo: jest.Mocked<IDlqRecordRepository>;
  let producer: jest.Mocked<Pick<DlqReplayProducer, 'produce'>>;
  let config: { getInstanceId: jest.Mock };
  let metrics: { dlqReplayAttemptsTotal: { inc: jest.Mock } };

  beforeEach(() => {
    repo = {
      acquireLock: jest.fn(),
      releaseAfterReplay: jest.fn(),
      updateStatusByAdmin: jest.fn(),
      findById: jest.fn(),
      findForReplay: jest.fn(),
      list: jest.fn(),
      upsertFromEnvelope: jest.fn(),
    };

    producer = { produce: jest.fn() };
    config = { getInstanceId: jest.fn().mockReturnValue('dlq-pod-1') };
    metrics = { dlqReplayAttemptsTotal: { inc: jest.fn() } };

    service = new DlqReplayService(
      repo,
      producer,
      config as unknown as ConfigurationService,
      metrics as unknown as MetricsService,
    );
  });

  describe('replayOne', () => {
    it('throws NotFoundException when record does not exist', async () => {
      repo.acquireLock.mockResolvedValue(null);
      repo.findById.mockResolvedValue(null);
      await expect(service.replayOne('bad-id', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when record is already locked', async () => {
      repo.acquireLock.mockResolvedValue(null);
      repo.findById.mockResolvedValue(baseRecord({ status: 'replaying', lockedBy: 'dlq-pod-2' }));
      await expect(service.replayOne('record-id-001', 'admin-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('produces to Kafka and sets status=pending on success', async () => {
      const locked = baseRecord({ status: 'replaying', lockedBy: 'dlq-pod-1', retryCount: 0 });
      const released = baseRecord({ status: 'pending', retryCount: 1 });

      repo.acquireLock.mockResolvedValue(locked);
      producer.produce.mockResolvedValue(undefined);
      repo.releaseAfterReplay.mockResolvedValue(released);

      const result = await service.replayOne('record-id-001', 'admin-1');

      expect(producer.produce).toHaveBeenCalledWith(
        expect.objectContaining({
          record: locked,
          triggeredBy: 'admin-1',
          attemptNumber: 1,
        }),
      );

      const releaseCall = repo.releaseAfterReplay.mock.calls[0][1];
      expect(releaseCall.nextStatus).toBe('pending');
      expect(releaseCall.newRetryCount).toBe(1);
      expect(releaseCall.nextRetryAt).toBeNull();
      expect(releaseCall.result).toBe('success');
      expect(result.status).toBe('pending');
    });

    it('on Kafka produce failure attempt 1 → pending with +5min backoff', async () => {
      const locked = baseRecord({ status: 'replaying', retryCount: 0, maxRetries: 3 });
      const released = baseRecord({ status: 'pending', retryCount: 1 });

      repo.acquireLock.mockResolvedValue(locked);
      producer.produce.mockRejectedValue(new Error('Kafka broker unavailable'));
      repo.releaseAfterReplay.mockResolvedValue(released);

      const before = Date.now();
      await service.replayOne('record-id-001', 'admin-1');

      const releaseCall = repo.releaseAfterReplay.mock.calls[0][1];
      expect(releaseCall.nextStatus).toBe('pending');
      expect(releaseCall.result).toBe('failure');
      const delay = (releaseCall.nextRetryAt as Date).getTime() - before;
      expect(delay).toBeGreaterThanOrEqual(5 * 60 * 1000 - 100);
      expect(delay).toBeLessThan(6 * 60 * 1000);
    });

    it('on Kafka produce failure attempt 2 → pending with +30min backoff', async () => {
      const locked = baseRecord({ status: 'replaying', retryCount: 1, maxRetries: 3 });
      repo.acquireLock.mockResolvedValue(locked);
      producer.produce.mockRejectedValue(new Error('Kafka broker unavailable'));
      repo.releaseAfterReplay.mockResolvedValue(baseRecord({ status: 'pending', retryCount: 2 }));

      const before = Date.now();
      await service.replayOne('record-id-001', 'admin-1');

      const delay =
        (repo.releaseAfterReplay.mock.calls[0][1].nextRetryAt as Date).getTime() - before;
      expect(delay).toBeGreaterThanOrEqual(30 * 60 * 1000 - 100);
      expect(delay).toBeLessThan(31 * 60 * 1000);
    });

    it('on Kafka produce failure attempt 3+ → pending with +2h backoff', async () => {
      const locked = baseRecord({ status: 'replaying', retryCount: 2, maxRetries: 5 });
      repo.acquireLock.mockResolvedValue(locked);
      producer.produce.mockRejectedValue(new Error('Kafka broker unavailable'));
      repo.releaseAfterReplay.mockResolvedValue(baseRecord({ status: 'pending', retryCount: 3 }));

      const before = Date.now();
      await service.replayOne('record-id-001', 'admin-1');

      const delay =
        (repo.releaseAfterReplay.mock.calls[0][1].nextRetryAt as Date).getTime() - before;
      expect(delay).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000 - 100);
      expect(delay).toBeLessThan(2 * 60 * 60 * 1000 + 60 * 1000);
    });

    it('on Kafka produce failure and retries exhausted → requires_manual_review', async () => {
      const locked = baseRecord({ status: 'replaying', retryCount: 2, maxRetries: 3 });
      const released = baseRecord({ status: 'requires_manual_review', retryCount: 3 });

      repo.acquireLock.mockResolvedValue(locked);
      producer.produce.mockRejectedValue(new Error('Kafka broker unavailable'));
      repo.releaseAfterReplay.mockResolvedValue(released);

      await service.replayOne('record-id-001', 'admin-1');

      const releaseCall = repo.releaseAfterReplay.mock.calls[0][1];
      expect(releaseCall.nextStatus).toBe('requires_manual_review');
      expect(releaseCall.nextRetryAt).toBeNull();
    });

    it('increments dlqReplayAttemptsTotal with result=success', async () => {
      const locked = baseRecord({ status: 'replaying' });
      repo.acquireLock.mockResolvedValue(locked);
      producer.produce.mockResolvedValue(undefined);
      repo.releaseAfterReplay.mockResolvedValue(baseRecord({ status: 'pending' }));

      await service.replayOne('record-id-001', 'admin-1');

      expect(metrics.dlqReplayAttemptsTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({ result: 'success', trigger: 'manual' }),
      );
    });
  });

  describe('resolveOne', () => {
    it('throws NotFoundException when record not found / already discarded', async () => {
      repo.updateStatusByAdmin.mockResolvedValue(null);
      await expect(service.resolveOne('bad-id', 'admin-1', 'noted')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('calls repo with resolved status and note', async () => {
      const updated = baseRecord({ status: 'resolved' });
      repo.updateStatusByAdmin.mockResolvedValue(updated);

      const result = await service.resolveOne('record-id-001', 'admin-1', 'handled manually');
      expect(repo.updateStatusByAdmin).toHaveBeenCalledWith(
        'record-id-001',
        'resolved',
        'admin-1',
        'handled manually',
      );
      expect(result.status).toBe('resolved');
    });
  });

  describe('discardOne', () => {
    it('throws NotFoundException when record does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.discardOne('bad-id', 'admin-1', 'no longer needed')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('calls repo with discarded status and note', async () => {
      const existing = baseRecord({ status: 'requires_manual_review' });
      const updated = baseRecord({ status: 'discarded' });
      repo.findById.mockResolvedValue(existing);
      repo.updateStatusByAdmin.mockResolvedValue(updated);

      const result = await service.discardOne('record-id-001', 'admin-1', 'event outdated');
      expect(repo.updateStatusByAdmin).toHaveBeenCalledWith(
        'record-id-001',
        'discarded',
        'admin-1',
        'event outdated',
      );
      expect(result.status).toBe('discarded');
    });
  });
});

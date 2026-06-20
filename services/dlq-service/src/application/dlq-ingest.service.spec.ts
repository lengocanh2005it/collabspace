import type { KafkaDlqEnvelope } from '@collabspace/shared';
import { DlqIngestService } from './dlq-ingest.service';
import type { IDlqRecordRepository } from '../domain/dlq-record.repository';
import type { DlqRecord } from '../domain/dlq-record.schema';
import type { ConfigurationService } from '../configuration/configuration.service';
import type { MetricsService } from '../metrics/metrics.service';

const makeEnvelope = (overrides: Partial<KafkaDlqEnvelope> = {}): KafkaDlqEnvelope => ({
  version: 1,
  sourceTopic: 'collabspace.task.events',
  partition: 0,
  offset: '42',
  payload: { id: 'task-1' },
  errorMessage: 'Something went wrong',
  failedAt: new Date().toISOString(),
  ...overrides,
});

const makeRecord = (overrides: Partial<DlqRecord> = {}): DlqRecord =>
  ({
    sourceTopic: 'collabspace.task.events',
    sourcePartition: 0,
    sourceOffset: '42',
    sourceKey: null,
    consumerGroup: null,
    payload: { id: 'task-1' },
    errorMessage: 'Something went wrong',
    errorCategory: 'unknown',
    failedAt: new Date(),
    status: 'pending',
    retryCount: 0,
    maxRetries: 1,
    nextRetryAt: new Date(),
    lastRetriedAt: null,
    replayedBy: null,
    resolvedBy: null,
    discardedBy: null,
    resolutionNote: null,
    retryHistory: [],
    lockedAt: null,
    lockedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as DlqRecord;

describe('DlqIngestService', () => {
  let service: DlqIngestService;
  let repo: jest.Mocked<IDlqRecordRepository>;
  let config: jest.Mocked<Pick<ConfigurationService, 'getDlqSchedulerConfig'>>;
  let metrics: { dlqConsumerEventsIngestedTotal: { inc: jest.Mock } };

  beforeEach(() => {
    repo = {
      upsertFromEnvelope: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<IDlqRecordRepository>;

    config = {
      getDlqSchedulerConfig: jest.fn().mockReturnValue({
        autoRetryEnabled: true,
        batchSize: 50,
        maxRetriesTransient: 3,
        maxRetriesUnknown: 1,
      }),
    };

    metrics = {
      dlqConsumerEventsIngestedTotal: { inc: jest.fn() },
    };

    service = new DlqIngestService(
      repo,
      config as unknown as ConfigurationService,
      metrics as unknown as MetricsService,
    );
  });

  describe('errorCategory classification', () => {
    it('transient → pending with maxRetries=3 and nextRetryAt in ~5min', async () => {
      const envelope = makeEnvelope({ errorCategory: 'transient' });
      const before = Date.now();
      repo.upsertFromEnvelope.mockResolvedValue(
        makeRecord({ status: 'pending', maxRetries: 3, errorCategory: 'transient' }),
      );

      await service.ingest(envelope);

      const call = repo.upsertFromEnvelope.mock.calls[0][0];
      expect(call.status).toBe('pending');
      expect(call.maxRetries).toBe(3);
      expect(call.nextRetryAt).not.toBeNull();
      const delta = call.nextRetryAt?.getTime() - before;
      expect(delta).toBeGreaterThan(4 * 60 * 1000);
      expect(delta).toBeLessThan(6 * 60 * 1000);
    });

    it('unknown → pending with maxRetries=1 and nextRetryAt in ~5min', async () => {
      const envelope = makeEnvelope({ errorCategory: 'unknown' });
      repo.upsertFromEnvelope.mockResolvedValue(makeRecord({ status: 'pending', maxRetries: 1 }));

      await service.ingest(envelope);

      const call = repo.upsertFromEnvelope.mock.calls[0][0];
      expect(call.status).toBe('pending');
      expect(call.maxRetries).toBe(1);
      expect(call.nextRetryAt).not.toBeNull();
    });

    it('no errorCategory → defaults to unknown → pending', async () => {
      const envelope = makeEnvelope();
      repo.upsertFromEnvelope.mockResolvedValue(makeRecord());

      await service.ingest(envelope);

      const call = repo.upsertFromEnvelope.mock.calls[0][0];
      expect(call.errorCategory).toBe('unknown');
      expect(call.status).toBe('pending');
    });

    it('logic → requires_manual_review with maxRetries=0, nextRetryAt=null', async () => {
      const envelope = makeEnvelope({ errorCategory: 'logic' });
      repo.upsertFromEnvelope.mockResolvedValue(
        makeRecord({ status: 'requires_manual_review', maxRetries: 0, nextRetryAt: null }),
      );

      await service.ingest(envelope);

      const call = repo.upsertFromEnvelope.mock.calls[0][0];
      expect(call.status).toBe('requires_manual_review');
      expect(call.maxRetries).toBe(0);
      expect(call.nextRetryAt).toBeNull();
    });

    it('schema → requires_manual_review with maxRetries=0, nextRetryAt=null', async () => {
      const envelope = makeEnvelope({ errorCategory: 'schema' });
      repo.upsertFromEnvelope.mockResolvedValue(
        makeRecord({ status: 'requires_manual_review', maxRetries: 0, nextRetryAt: null }),
      );

      await service.ingest(envelope);

      const call = repo.upsertFromEnvelope.mock.calls[0][0];
      expect(call.status).toBe('requires_manual_review');
      expect(call.maxRetries).toBe(0);
      expect(call.nextRetryAt).toBeNull();
    });
  });

  it('passes envelope fields through correctly', async () => {
    const envelope = makeEnvelope({
      errorCategory: 'transient',
      key: 'task-key-123',
      consumerGroup: 'notification-service',
    });
    repo.upsertFromEnvelope.mockResolvedValue(makeRecord());

    await service.ingest(envelope);

    const call = repo.upsertFromEnvelope.mock.calls[0][0];
    expect(call.sourceTopic).toBe(envelope.sourceTopic);
    expect(call.sourcePartition).toBe(envelope.partition);
    expect(call.sourceOffset).toBe(envelope.offset);
    expect(call.sourceKey).toBe('task-key-123');
    expect(call.consumerGroup).toBe('notification-service');
    expect(call.errorMessage).toBe(envelope.errorMessage);
  });

  it('increments dlqConsumerEventsIngestedTotal metric', async () => {
    const envelope = makeEnvelope({ errorCategory: 'transient' });
    repo.upsertFromEnvelope.mockResolvedValue(makeRecord());

    await service.ingest(envelope);

    expect(metrics.dlqConsumerEventsIngestedTotal.inc).toHaveBeenCalledWith({
      sourceTopic: envelope.sourceTopic,
      errorCategory: 'transient',
    });
  });
});

import { ConfigurationService } from '@/configuration/configuration.service';
import { DataSource } from 'typeorm';
import { AuthOutboxService } from './auth-outbox.service';

describe('AuthOutboxService', () => {
  const repositoryMock = {
    create: jest.fn((value) => value),
    findOneBy: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const dataSourceMock = {
    getMetadata: jest.fn(() => ({
      tablePath: 'auth_outbox_events',
    })),
    manager: {
      getRepository: jest.fn(() => repositoryMock),
    },
    query: jest.fn(),
    transaction: jest.fn(
      async (runInTransaction: (manager: { query: jest.Mock }) => unknown) =>
        runInTransaction({ query: jest.fn() }),
    ),
  } as unknown as DataSource;
  const configurationServiceMock = {
    getOutboxConfig: jest.fn(() => ({
      batchSize: 20,
      degradedFailedThreshold: 1,
      degradedPendingThreshold: 50,
      enabled: true,
      maxAttempts: 10,
      pollIntervalMs: 5000,
      staleClaimThresholdMs: 60000,
    })),
  } as unknown as ConfigurationService;

  let service: AuthOutboxService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthOutboxService(configurationServiceMock, dataSourceMock);
  });

  it('returns normalized outbox stats', async () => {
    jest.spyOn(dataSourceMock, 'query').mockResolvedValue([
      {
        failedCount: '2',
        oldestFailedAt: '2026-05-12T00:00:00.000Z',
        oldestPendingAt: '2026-05-11T00:00:00.000Z',
        pendingCount: '5',
        processedCount: '8',
        processingCount: '1',
        staleProcessingCount: '1',
      },
    ]);

    await expect(service.getStats()).resolves.toEqual({
      failedCount: 2,
      oldestFailedAt: '2026-05-12T00:00:00.000Z',
      oldestPendingAt: '2026-05-11T00:00:00.000Z',
      pendingCount: 5,
      processedCount: 8,
      processingCount: 1,
      staleProcessingCount: 1,
    });
  });

  it('reclaims stale claims and returns the reclaimed count', async () => {
    jest
      .spyOn(dataSourceMock, 'query')
      .mockResolvedValueOnce([[{ id: 'event-1' }], 1]);

    await expect(service.reclaimStaleClaims()).resolves.toBe(1);
  });

  it('returns zero when TypeORM pg driver yields [rows, rowCount] with no matches', async () => {
    const queryMock = jest
      .spyOn(dataSourceMock, 'query')
      .mockResolvedValue([[], 0]);

    await expect(service.reclaimStaleClaims()).resolves.toBe(0);
    await expect(service.markExhaustedClaims()).resolves.toBe(0);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('marks exhausted claims separately', async () => {
    jest
      .spyOn(dataSourceMock, 'query')
      .mockResolvedValueOnce([[{ id: 'event-9' }], 1]);

    await expect(service.markExhaustedClaims()).resolves.toBe(1);
  });

  it('replays a failed event by resetting its failure state', async () => {
    jest.spyOn(repositoryMock, 'findOneBy').mockResolvedValue({
      failedAt: new Date('2026-05-12T00:00:00.000Z'),
      id: 'event-3',
    });
    jest.spyOn(repositoryMock, 'update').mockResolvedValue({
      affected: 1,
    });

    await expect(service.replayFailedEvent('event-3')).resolves.toBeUndefined();

    expect(repositoryMock.update).toHaveBeenCalledWith(
      { id: 'event-3' },
      expect.objectContaining({
        availableAt: expect.any(Date),
        claimedAt: null,
        failedAt: null,
        lastError: null,
      }),
    );
  });

  it('rejects replay for a non-failed event', async () => {
    jest.spyOn(repositoryMock, 'findOneBy').mockResolvedValue({
      failedAt: null,
      id: 'event-4',
    });

    await expect(service.replayFailedEvent('event-4')).rejects.toThrow(
      'Outbox event event-4 is not in failed state',
    );
  });

  it('normalizes pg QueryResult rows when claiming pending events', async () => {
    const managerQuery = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'event-5' }] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        rows: [
          {
            attemptCount: 1,
            eventType: 'auth.email_verification_otp',
            id: 'event-5',
            payload: { email: 'member@example.com', otp: '123456' },
          },
        ],
      });
    jest
      .spyOn(dataSourceMock, 'transaction')
      .mockImplementation(
        async (runInTransaction: (manager: { query: jest.Mock }) => unknown) =>
          runInTransaction({ query: managerQuery }),
      );

    await expect(service.claimPendingBatch(1)).resolves.toEqual([
      {
        attemptCount: 1,
        eventType: 'auth.email_verification_otp',
        id: 'event-5',
        payload: { email: 'member@example.com', otp: '123456' },
      },
    ]);
  });
});

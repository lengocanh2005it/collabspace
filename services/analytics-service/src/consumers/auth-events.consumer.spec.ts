import { AuthEventsConsumer } from './auth-events.consumer.js';
import type { AnalyticsRepository } from '../analytics/repositories/analytics.repository.js';

const makeRepo = (): jest.Mocked<AnalyticsRepository> =>
  ({
    processEventOnce: jest.fn(async (_eventId, _eventType, _topic, handler) => {
      await handler();
      return true;
    }),
    incrementSnapshot: jest.fn().mockResolvedValue(undefined),
    decrementSnapshot: jest.fn().mockResolvedValue(undefined),
    incrementTimeseries: jest.fn().mockResolvedValue(undefined),
    getSnapshot: jest.fn(),
    getTimeseries: jest.fn(),
  }) as unknown as jest.Mocked<AnalyticsRepository>;

const makeConsumer = (repo: AnalyticsRepository) =>
  new AuthEventsConsumer(
    {
      getKafkaConfig: () => ({
        userRegisteredTopic: 'collabspace.user.registered',
      }),
    } as never,
    repo,
    {} as never,
  );

describe('AuthEventsConsumer.handleAuthEvent', () => {
  let repo: jest.Mocked<AnalyticsRepository>;
  let consumer: AuthEventsConsumer;

  beforeEach(() => {
    repo = makeRepo();
    consumer = makeConsumer(repo);
  });

  it('increments users.total and users.active on user_registered', async () => {
    await consumer.handleAuthEvent({
      userId: 'user-1',
      fullName: 'User One',
      occurredAt: '2026-06-20T10:00:00.000Z',
    });

    expect(repo.processEventOnce).toHaveBeenCalledWith(
      'user_registered:user-1',
      'user_registered',
      'collabspace.user.registered',
      expect.any(Function),
    );
    expect(repo.incrementSnapshot).toHaveBeenCalledWith('users.total', 1);
    expect(repo.incrementSnapshot).toHaveBeenCalledWith('users.active', 1);
    expect(repo.incrementTimeseries).toHaveBeenCalledWith('2026-06-20', 'users_registered', 1);
  });

  it('does not call repository for invalid payload', async () => {
    await consumer.handleAuthEvent({ type: 'user_login' });

    expect(repo.processEventOnce).not.toHaveBeenCalled();
    expect(repo.incrementSnapshot).not.toHaveBeenCalled();
    expect(repo.incrementTimeseries).not.toHaveBeenCalled();
  });

  it('uses eventId when present', async () => {
    await consumer.handleAuthEvent({
      eventId: 'event-1',
      userId: 'user-1',
      fullName: 'User One',
    });

    expect(repo.processEventOnce).toHaveBeenCalledWith(
      'event-1',
      'user_registered',
      'collabspace.user.registered',
      expect.any(Function),
    );
  });
});

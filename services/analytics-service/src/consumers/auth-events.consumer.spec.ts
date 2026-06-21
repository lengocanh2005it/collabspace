import { AuthEventsConsumer } from './auth-events.consumer.js';
import type { AnalyticsRepository } from '../analytics/repositories/analytics.repository.js';

const makeRepo = (): jest.Mocked<AnalyticsRepository> =>
  ({
    incrementSnapshot: jest.fn().mockResolvedValue(undefined),
    decrementSnapshot: jest.fn().mockResolvedValue(undefined),
    incrementTimeseries: jest.fn().mockResolvedValue(undefined),
    getSnapshot: jest.fn(),
    getTimeseries: jest.fn(),
  }) as unknown as jest.Mocked<AnalyticsRepository>;

const makeConsumer = (repo: AnalyticsRepository) =>
  new AuthEventsConsumer({} as never, repo, {} as never);

describe('AuthEventsConsumer.handleAuthEvent', () => {
  let repo: jest.Mocked<AnalyticsRepository>;
  let consumer: AuthEventsConsumer;

  beforeEach(() => {
    repo = makeRepo();
    consumer = makeConsumer(repo);
  });

  it('increments users.total and users.active on user_registered', async () => {
    await consumer.handleAuthEvent({ type: 'user_registered' });

    expect(repo.incrementSnapshot).toHaveBeenCalledWith('users.total', 1);
    expect(repo.incrementSnapshot).toHaveBeenCalledWith('users.active', 1);
    expect(repo.incrementTimeseries).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      'users_registered',
      1,
    );
  });

  it('does not call repository for user_login', async () => {
    await consumer.handleAuthEvent({ type: 'user_login' });

    expect(repo.incrementSnapshot).not.toHaveBeenCalled();
    expect(repo.incrementTimeseries).not.toHaveBeenCalled();
  });

  it('does not call repository for unknown event type', async () => {
    await consumer.handleAuthEvent({ type: 'unknown' });

    expect(repo.incrementSnapshot).not.toHaveBeenCalled();
  });
});

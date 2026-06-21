import { AnalyticsService } from './analytics.service.js';
import type { AnalyticsRepository } from '../repositories/analytics.repository.js';

const makeRepo = (snapshot: object | null = null): jest.Mocked<AnalyticsRepository> =>
  ({
    getSnapshot: jest.fn().mockResolvedValue(snapshot),
    getTimeseries: jest.fn().mockResolvedValue([]),
    incrementSnapshot: jest.fn(),
    decrementSnapshot: jest.fn(),
    incrementTimeseries: jest.fn(),
  }) as unknown as jest.Mocked<AnalyticsRepository>;

describe('AnalyticsService', () => {
  describe('getOverview', () => {
    it('returns zero snapshot when no document exists', async () => {
      const service = new AnalyticsService(makeRepo(null));
      const result = await service.getOverview();

      expect(result.users.total).toBe(0);
      expect(result.tasks.byStatus.TODO).toBe(0);
    });

    it('maps snapshot document to response dto', async () => {
      const snapshot = {
        users: { total: 10, active: 8, banned: 2, withoutWorkspace: 1, activeLast30d: 7 },
        workspaces: { total: 5, totalMembers: 20, avgMembersPerWorkspace: 4 },
        projects: { total: 15 },
        tasks: { total: 30, byStatus: { TODO: 10, DOING: 8, DONE: 12 } },
        updatedAt: new Date('2026-06-21T00:00:00Z'),
      };

      const service = new AnalyticsService(makeRepo(snapshot));
      const result = await service.getOverview();

      expect(result.users.total).toBe(10);
      expect(result.users.active).toBe(8);
      expect(result.workspaces.avgMembersPerWorkspace).toBe(4);
      expect(result.tasks.byStatus.DONE).toBe(12);
      expect(result.updatedAt).toBe('2026-06-21T00:00:00.000Z');
    });
  });

  describe('getActivity', () => {
    it('fills zero for dates with no timeseries row', async () => {
      const repo = makeRepo();
      repo.getTimeseries.mockResolvedValue([{ date: '2026-06-20', value: 5 } as never]);

      const service = new AnalyticsService(repo);
      const result = await service.getActivity('tasks_created', '2026-06-19', '2026-06-21', 'day');

      expect(result.data).toEqual([
        { date: '2026-06-19', value: 0 },
        { date: '2026-06-20', value: 5 },
        { date: '2026-06-21', value: 0 },
      ]);
    });

    it('returns correct metric/interval/from/to in response', async () => {
      const service = new AnalyticsService(makeRepo());
      const result = await service.getActivity(
        'users_registered',
        '2026-06-01',
        '2026-06-01',
        'day',
      );

      expect(result.metric).toBe('users_registered');
      expect(result.interval).toBe('day');
      expect(result.from).toBe('2026-06-01');
      expect(result.to).toBe('2026-06-01');
    });
  });
});

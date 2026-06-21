import { WorkspaceEventsConsumer } from './workspace-events.consumer.js';
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
  new WorkspaceEventsConsumer({} as never, repo, {} as never);

describe('WorkspaceEventsConsumer.handleWorkspaceEvent', () => {
  let repo: jest.Mocked<AnalyticsRepository>;
  let consumer: WorkspaceEventsConsumer;

  beforeEach(() => {
    repo = makeRepo();
    consumer = makeConsumer(repo);
  });

  it('increments workspaces.total and timeseries on workspace_created', async () => {
    await consumer.handleWorkspaceEvent({ type: 'workspace_created' });

    expect(repo.incrementSnapshot).toHaveBeenCalledWith('workspaces.total', 1);
    expect(repo.incrementTimeseries).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      'workspaces_created',
      1,
    );
  });

  it('increments projects.total on project_created', async () => {
    await consumer.handleWorkspaceEvent({ type: 'project_created' });

    expect(repo.incrementSnapshot).toHaveBeenCalledWith('projects.total', 1);
    expect(repo.incrementTimeseries).not.toHaveBeenCalled();
  });

  it('increments workspaces.totalMembers on member_joined', async () => {
    await consumer.handleWorkspaceEvent({ type: 'member_joined' });

    expect(repo.incrementSnapshot).toHaveBeenCalledWith('workspaces.totalMembers', 1);
  });

  it('decrements workspaces.totalMembers on member_left', async () => {
    await consumer.handleWorkspaceEvent({ type: 'member_left' });

    expect(repo.decrementSnapshot).toHaveBeenCalledWith('workspaces.totalMembers', 1);
  });

  it('does not call repository for unknown event type', async () => {
    await consumer.handleWorkspaceEvent({ type: 'unknown' });

    expect(repo.incrementSnapshot).not.toHaveBeenCalled();
    expect(repo.decrementSnapshot).not.toHaveBeenCalled();
  });
});

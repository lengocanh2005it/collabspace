import { WorkspaceEventsConsumer } from './workspace-events.consumer.js';
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
  new WorkspaceEventsConsumer(
    {
      getKafkaConfig: () => ({
        workspaceCreatedTopic: 'collabspace.workspace.workspace_created',
        workspaceProjectCreatedTopic: 'collabspace.workspace.project_created',
        workspaceMemberJoinedTopic: 'collabspace.workspace.member_joined',
        workspaceMemberLeftTopic: 'collabspace.workspace.member_left',
      }),
    } as never,
    repo,
    {} as never,
  );

describe('WorkspaceEventsConsumer.handleWorkspaceEvent', () => {
  let repo: jest.Mocked<AnalyticsRepository>;
  let consumer: WorkspaceEventsConsumer;

  beforeEach(() => {
    repo = makeRepo();
    consumer = makeConsumer(repo);
  });

  it('increments workspaces.total and timeseries on workspace_created', async () => {
    await consumer.handleWorkspaceEvent({
      eventId: 'event-1',
      occurredAt: '2026-06-20T10:00:00.000Z',
      ownerId: 'owner-1',
      workspaceId: 'workspace-1',
      workspaceName: 'Workspace',
    });

    expect(repo.incrementSnapshot).toHaveBeenCalledWith('workspaces.total', 1);
    expect(repo.incrementSnapshot).toHaveBeenCalledWith('workspaces.totalMembers', 1);
    expect(repo.incrementTimeseries).toHaveBeenCalledWith('2026-06-20', 'workspaces_created', 1);
  });

  it('increments projects.total on project_created', async () => {
    await consumer.handleWorkspaceEvent(
      {
        eventId: 'event-2',
        occurredAt: '2026-06-20T10:00:00.000Z',
        createdBy: 'user-1',
        projectId: 'project-1',
        projectName: 'Project',
        workspaceId: 'workspace-1',
      },
      'collabspace.workspace.project_created',
    );

    expect(repo.incrementSnapshot).toHaveBeenCalledWith('projects.total', 1);
    expect(repo.incrementTimeseries).not.toHaveBeenCalled();
  });

  it('increments workspaces.totalMembers on member_joined', async () => {
    await consumer.handleWorkspaceEvent(
      {
        eventId: 'event-3',
        occurredAt: '2026-06-20T10:00:00.000Z',
        role: 'member',
        userId: 'user-1',
        workspaceId: 'workspace-1',
      },
      'collabspace.workspace.member_joined',
    );

    expect(repo.incrementSnapshot).toHaveBeenCalledWith('workspaces.totalMembers', 1);
  });

  it('decrements workspaces.totalMembers on member_left', async () => {
    await consumer.handleWorkspaceEvent(
      {
        eventId: 'event-4',
        occurredAt: '2026-06-20T10:00:00.000Z',
        userId: 'user-1',
        workspaceId: 'workspace-1',
      },
      'collabspace.workspace.member_left',
    );

    expect(repo.decrementSnapshot).toHaveBeenCalledWith('workspaces.totalMembers', 1);
  });

  it('does not call repository for unknown event type', async () => {
    await consumer.handleWorkspaceEvent({ type: 'unknown' }, 'collabspace.workspace.unknown');

    expect(repo.processEventOnce).not.toHaveBeenCalled();
    expect(repo.incrementSnapshot).not.toHaveBeenCalled();
    expect(repo.decrementSnapshot).not.toHaveBeenCalled();
  });
});

import { TaskEventsConsumer } from './task-events.consumer.js';
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
  new TaskEventsConsumer(
    {
      getKafkaConfig: () => ({
        taskCreatedTopic: 'collabspace.task.task_created',
        taskStatusChangedTopic: 'collabspace.task.task_status_changed',
        taskDeletedTopic: 'collabspace.task.task_deleted',
      }),
    } as never,
    repo,
    {} as never,
  );

describe('TaskEventsConsumer.handleTaskEvent', () => {
  let repo: jest.Mocked<AnalyticsRepository>;
  let consumer: TaskEventsConsumer;

  beforeEach(() => {
    repo = makeRepo();
    consumer = makeConsumer(repo);
  });

  it('increments tasks.total and byStatus on task_created', async () => {
    await consumer.handleTaskEvent({
      eventId: 'event-1',
      occurredAt: '2026-06-20T10:00:00.000Z',
      creatorId: 'user-1',
      status: 'TODO',
      taskId: 'task-1',
      taskTitle: 'Task',
      workspaceId: 'workspace-1',
    });

    expect(repo.incrementSnapshot).toHaveBeenCalledWith('tasks.total', 1);
    expect(repo.incrementSnapshot).toHaveBeenCalledWith('tasks.byStatus.TODO', 1);
    expect(repo.incrementTimeseries).toHaveBeenCalledWith('2026-06-20', 'tasks_created', 1);
  });

  it('moves byStatus counter on task_status_changed', async () => {
    await consumer.handleTaskEvent(
      {
        eventId: 'event-2',
        occurredAt: '2026-06-20T10:00:00.000Z',
        previousStatus: 'TODO',
        newStatus: 'DOING',
        taskId: 'task-1',
        workspaceId: 'workspace-1',
      },
      'collabspace.task.task_status_changed',
    );

    expect(repo.decrementSnapshot).toHaveBeenCalledWith('tasks.byStatus.TODO', 1);
    expect(repo.incrementSnapshot).toHaveBeenCalledWith('tasks.byStatus.DOING', 1);
    expect(repo.incrementTimeseries).not.toHaveBeenCalled();
  });

  it('records tasks_completed timeseries when newStatus is DONE', async () => {
    await consumer.handleTaskEvent(
      {
        eventId: 'event-3',
        occurredAt: '2026-06-20T10:00:00.000Z',
        previousStatus: 'DOING',
        newStatus: 'DONE',
        taskId: 'task-1',
        workspaceId: 'workspace-1',
      },
      'collabspace.task.task_status_changed',
    );

    expect(repo.incrementTimeseries).toHaveBeenCalledWith('2026-06-20', 'tasks_completed', 1);
  });

  it('decrements tasks.total and byStatus on task_deleted', async () => {
    await consumer.handleTaskEvent(
      {
        eventId: 'event-4',
        occurredAt: '2026-06-20T10:00:00.000Z',
        actorId: 'user-1',
        status: 'DOING',
        taskId: 'task-1',
        workspaceId: 'workspace-1',
      },
      'collabspace.task.task_deleted',
    );

    expect(repo.decrementSnapshot).toHaveBeenCalledWith('tasks.total', 1);
    expect(repo.decrementSnapshot).toHaveBeenCalledWith('tasks.byStatus.DOING', 1);
  });

  it('does not call repository for unknown event type', async () => {
    await consumer.handleTaskEvent({ type: 'unknown_event' }, 'collabspace.task.unknown');

    expect(repo.processEventOnce).not.toHaveBeenCalled();
    expect(repo.incrementSnapshot).not.toHaveBeenCalled();
    expect(repo.decrementSnapshot).not.toHaveBeenCalled();
    expect(repo.incrementTimeseries).not.toHaveBeenCalled();
  });
});

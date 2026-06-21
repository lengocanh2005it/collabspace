import { TaskEventsConsumer } from './task-events.consumer.js';
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
  new TaskEventsConsumer({} as never, repo, {} as never);

describe('TaskEventsConsumer.handleTaskEvent', () => {
  let repo: jest.Mocked<AnalyticsRepository>;
  let consumer: TaskEventsConsumer;

  beforeEach(() => {
    repo = makeRepo();
    consumer = makeConsumer(repo);
  });

  it('increments tasks.total and byStatus on task_created', async () => {
    await consumer.handleTaskEvent({ type: 'task_created', status: 'TODO' });

    expect(repo.incrementSnapshot).toHaveBeenCalledWith('tasks.total', 1);
    expect(repo.incrementSnapshot).toHaveBeenCalledWith('tasks.byStatus.TODO', 1);
    expect(repo.incrementTimeseries).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      'tasks_created',
      1,
    );
  });

  it('defaults status to TODO when missing on task_created', async () => {
    await consumer.handleTaskEvent({ type: 'task_created' });

    expect(repo.incrementSnapshot).toHaveBeenCalledWith('tasks.byStatus.TODO', 1);
  });

  it('moves byStatus counter on task_status_changed', async () => {
    await consumer.handleTaskEvent({
      type: 'task_status_changed',
      previousStatus: 'TODO',
      newStatus: 'DOING',
    });

    expect(repo.decrementSnapshot).toHaveBeenCalledWith('tasks.byStatus.TODO', 1);
    expect(repo.incrementSnapshot).toHaveBeenCalledWith('tasks.byStatus.DOING', 1);
    expect(repo.incrementTimeseries).not.toHaveBeenCalled();
  });

  it('records tasks_completed timeseries when newStatus is DONE', async () => {
    await consumer.handleTaskEvent({
      type: 'task_status_changed',
      previousStatus: 'DOING',
      newStatus: 'DONE',
    });

    expect(repo.incrementTimeseries).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      'tasks_completed',
      1,
    );
  });

  it('decrements tasks.total and byStatus on task_deleted', async () => {
    await consumer.handleTaskEvent({ type: 'task_deleted', status: 'DOING' });

    expect(repo.decrementSnapshot).toHaveBeenCalledWith('tasks.total', 1);
    expect(repo.decrementSnapshot).toHaveBeenCalledWith('tasks.byStatus.DOING', 1);
  });

  it('does not call repository for unknown event type', async () => {
    await consumer.handleTaskEvent({ type: 'unknown_event' });

    expect(repo.incrementSnapshot).not.toHaveBeenCalled();
    expect(repo.decrementSnapshot).not.toHaveBeenCalled();
    expect(repo.incrementTimeseries).not.toHaveBeenCalled();
  });
});

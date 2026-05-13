import { GetTasksHandler } from './get-tasks.handler';
import { GetTasksQuery } from '../queries/get-tasks.query';
import { ITaskRepository } from '../ports/ITaskRepository';
import { Task } from '../../domain/entities/Task';
import { TaskId } from '../../domain/value-objects/TaskId';
import { UserSnapshot } from '../../domain/value-objects/UserSnapshot';

describe('GetTasksHandler', () => {
  let handler: GetTasksHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    mockTaskRepo = {
      addAsync: jest.fn(),
      updateAsync: jest.fn(),
      deleteAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      findByWorkspaceIdAsync: jest.fn(),
    };

    handler = new GetTasksHandler(mockTaskRepo);
  });

  const createMockTask = (id: string, status: string, assigneeId: string | null) => {
    const creatorSnapshot = UserSnapshot.create('creator-1', 'c@c.c', 'Creator', 'Creator', 'url');
    return Task.restore(
      new TaskId(id),
      'Task Title',
      'Desc',
      status,
      'workspace-1',
      assigneeId,
      assigneeId ? UserSnapshot.create(assigneeId, 'a@a.c', 'Assignee', 'Assignee', 'url') : null,
      creatorSnapshot,
      new Date(),
      new Date(),
      []
    );
  };

  it('should return all tasks for a workspace', async () => {
    const tasks = [
      createMockTask('123e4567-e89b-12d3-a456-426614174002', 'TODO', null),
      createMockTask('123e4567-e89b-12d3-a456-426614174003', 'DOING', 'user-1'),
    ];

    mockTaskRepo.findByWorkspaceIdAsync.mockResolvedValue(tasks);

    const query = new GetTasksQuery('workspace-1');
    const result = await handler.execute(query);

    expect(result.total).toBe(2);
    expect(result.tasks).toHaveLength(2);
  });

  it('should filter tasks by status', async () => {
    const tasks = [
      createMockTask('123e4567-e89b-12d3-a456-426614174002', 'TODO', null),
      createMockTask('123e4567-e89b-12d3-a456-426614174003', 'DOING', 'user-1'),
    ];

    mockTaskRepo.findByWorkspaceIdAsync.mockResolvedValue(tasks);

    const query = new GetTasksQuery('workspace-1', 'TODO');
    const result = await handler.execute(query);

    expect(result.total).toBe(1);
    expect(result.tasks[0].id).toBe('123e4567-e89b-12d3-a456-426614174002');
  });

  it('should filter tasks by assigneeId', async () => {
    const tasks = [
      createMockTask('123e4567-e89b-12d3-a456-426614174002', 'TODO', null),
      createMockTask('123e4567-e89b-12d3-a456-426614174003', 'DOING', 'user-1'),
    ];

    mockTaskRepo.findByWorkspaceIdAsync.mockResolvedValue(tasks);

    const query = new GetTasksQuery('workspace-1', undefined, 'user-1');
    const result = await handler.execute(query);

    expect(result.total).toBe(1);
    expect(result.tasks[0].id).toBe('123e4567-e89b-12d3-a456-426614174003');
  });
});

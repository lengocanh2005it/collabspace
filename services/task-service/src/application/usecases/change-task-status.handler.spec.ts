import { ChangeTaskStatusHandler } from './change-task-status.handler';
import { ChangeTaskStatusCommand } from '../commands/change-task-status.command';
import { ITaskRepository } from '../ports/ITaskRepository';
import { Task } from '../../domain/entities/Task';
import { TaskId } from '../../domain/value-objects/TaskId';
import { UserSnapshot } from '../../domain/value-objects/UserSnapshot';
import { EntityNotFoundException } from '../../domain/exceptions/EntityNotFoundException';
import { BusinessRuleException } from '../../domain/exceptions/BusinessRuleException';

describe('ChangeTaskStatusHandler', () => {
  let handler: ChangeTaskStatusHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    mockTaskRepo = {
      addAsync: jest.fn(),
      updateAsync: jest.fn(),
      deleteAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      findByWorkspaceIdAsync: jest.fn(),
    };

    handler = new ChangeTaskStatusHandler(mockTaskRepo);
  });

  const createMockTask = (status: string = 'TODO') => {
    const creatorSnapshot = UserSnapshot.create('creator-1', 'c@c.c', 'Creator', 'Creator', 'url');
    return Task.restore(
      new TaskId('123e4567-e89b-12d3-a456-426614174000'),
      'Task Title',
      'Desc',
      status,
      'workspace-1',
      null,
      null,
      creatorSnapshot,
      new Date(),
      new Date(),
      []
    );
  };

  it('should change status of an existing task', async () => {
    const task = createMockTask('TODO');
    const command = new ChangeTaskStatusCommand('123e4567-e89b-12d3-a456-426614174000', 'DOING');

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);

    await handler.execute(command);

    expect(task.getStatus().getValue()).toBe('DOING');
    expect(mockTaskRepo.updateAsync).toHaveBeenCalledWith(task);
  });

  it('should throw EntityNotFoundException if task does not exist', async () => {
    const command = new ChangeTaskStatusCommand('123e4567-e89b-12d3-a456-426614174000', 'DOING');
    mockTaskRepo.findByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(EntityNotFoundException);
    expect(mockTaskRepo.updateAsync).not.toHaveBeenCalled();
  });

  it('should throw BusinessRuleException when transitioning from DONE to TODO', async () => {
    const task = createMockTask('DONE');
    const command = new ChangeTaskStatusCommand('123e4567-e89b-12d3-a456-426614174000', 'TODO');

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);

    await expect(handler.execute(command)).rejects.toThrow(BusinessRuleException);
    await expect(handler.execute(command)).rejects.toThrow('Business Rule Violated: Cannot move from DONE to TODO');
    
    // Status should remain unchanged
    expect(task.getStatus().getValue()).toBe('DONE');
    expect(mockTaskRepo.updateAsync).not.toHaveBeenCalled();
  });

  it('should allow transitioning from TODO to DONE', async () => {
    const task = createMockTask('TODO');
    const command = new ChangeTaskStatusCommand('123e4567-e89b-12d3-a456-426614174000', 'DONE');

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);

    await handler.execute(command);

    expect(task.getStatus().getValue()).toBe('DONE');
    expect(mockTaskRepo.updateAsync).toHaveBeenCalledWith(task);
  });
});

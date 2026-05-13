import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeleteCommentHandler } from './delete-comment.handler';
import { DeleteCommentCommand } from './delete-comment.command';
import { ITaskRepository } from '../../../../application/ports/ITaskRepository';
import { ICommentRepository } from '../../../../domain/repositories/comment.repository.interface';
import { Task } from '../../../../domain/entities/Task';
import { TaskId } from '../../../../domain/value-objects/TaskId';
import { UserSnapshot } from '../../../../domain/value-objects/UserSnapshot';
import { Comment } from '../../../../domain/entities/comment.entity';

describe('DeleteCommentHandler', () => {
  let handler: DeleteCommentHandler;
  let mockCommentRepo: jest.Mocked<ICommentRepository>;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    mockCommentRepo = {
      createAsync: jest.fn(),
      getTaskCommentsAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      deleteAsync: jest.fn(),
      updateAsync: jest.fn(),
      findByTaskIdAsync: jest.fn(),
    } as any;

    mockTaskRepo = {
      addAsync: jest.fn(),
      updateAsync: jest.fn(),
      deleteAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      findByWorkspaceIdAsync: jest.fn(),
    };

    handler = new DeleteCommentHandler(mockCommentRepo, mockTaskRepo);
  });

  const createMockTask = () => {
    const creatorSnapshot = UserSnapshot.create('creator-1', 'c@c.c', 'Creator', 'Creator', 'url');
    return Task.restore(new TaskId('123e4567-e89b-12d3-a456-426614174000'), 'Title', 'Desc', 'TODO', 'workspace-1', null, null, creatorSnapshot, new Date(), new Date(), []);
  };

  const createMockComment = (authorId: string) => {
    return Comment.create('123e4567-e89b-12d3-a456-426614174001', '123e4567-e89b-12d3-a456-426614174000', authorId, 'Author Name', 'url', 'Original Content');
  };

  it('should delete comment successfully', async () => {
    const command = new DeleteCommentCommand('123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001', 'author-1');
    const task = createMockTask();
    const comment = createMockComment('author-1');

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);
    mockCommentRepo.findByIdAsync.mockResolvedValue(comment);
    mockCommentRepo.updateAsync.mockResolvedValue(true);

    const result = await handler.execute(command);

    expect(result.commentId).toBe('123e4567-e89b-12d3-a456-426614174001');
    expect(comment.isDeleted()).toBe(true);
    expect(mockCommentRepo.updateAsync).toHaveBeenCalledWith(comment);
  });

  it('should throw NotFoundException if task does not exist', async () => {
    const command = new DeleteCommentCommand('123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001', 'author-1');
    mockTaskRepo.findByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    expect(mockCommentRepo.updateAsync).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException if comment does not exist', async () => {
    const command = new DeleteCommentCommand('123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001', 'author-1');
    const task = createMockTask();

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);
    mockCommentRepo.findByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if author does not own comment', async () => {
    const command = new DeleteCommentCommand('123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001', 'author-2'); // different author
    const task = createMockTask();
    const comment = createMockComment('author-1');

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);
    mockCommentRepo.findByIdAsync.mockResolvedValue(comment);

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
    expect(mockCommentRepo.updateAsync).not.toHaveBeenCalled();
  });
});

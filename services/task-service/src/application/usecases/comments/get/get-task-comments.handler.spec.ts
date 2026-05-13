import { GetTaskCommentsHandler } from './get-task-comments.handler';
import { GetTaskCommentsQuery } from './get-task-comments.query';
import { ICommentRepository } from '../../../../domain/repositories/comment.repository.interface';
import { Comment } from '../../../../domain/entities/comment.entity';

describe('GetTaskCommentsHandler', () => {
  let handler: GetTaskCommentsHandler;
  let mockCommentRepo: jest.Mocked<ICommentRepository>;

  beforeEach(() => {
    mockCommentRepo = {
      createAsync: jest.fn(),
      getTaskCommentsAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      deleteAsync: jest.fn(),
      updateAsync: jest.fn(),
      findByTaskIdAsync: jest.fn(),
    } as any;

    handler = new GetTaskCommentsHandler(mockCommentRepo);
  });

  const createMockComment = (id: string, isDeleted: boolean) => {
    const comment = Comment.create(id, '123e4567-e89b-12d3-a456-426614174000', 'author-1', 'Author Name', 'url', 'Content');
    if (isDeleted) {
      comment.markAsDeleted();
    }
    return comment;
  };

  it('should return comments for a task, filtering out deleted ones', async () => {
    const query = new GetTaskCommentsQuery('123e4567-e89b-12d3-a456-426614174000', 0, 10);
    const comments = [
      createMockComment('comment-1', false),
      createMockComment('comment-2', true), // Should be filtered out
      createMockComment('comment-3', false),
    ];

    mockCommentRepo.findByTaskIdAsync.mockResolvedValue(comments);

    const result = await handler.execute(query);

    expect(result.total).toBe(2);
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0].id).toBe('comment-1');
    expect(result.comments[1].id).toBe('comment-3');
    expect(mockCommentRepo.findByTaskIdAsync).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', { skip: 0, limit: 10 });
  });

  it('should return empty list if no comments exist', async () => {
    const query = new GetTaskCommentsQuery('123e4567-e89b-12d3-a456-426614174000', 0, 10);
    mockCommentRepo.findByTaskIdAsync.mockResolvedValue([]);

    const result = await handler.execute(query);

    expect(result.total).toBe(0);
    expect(result.comments).toHaveLength(0);
  });
});

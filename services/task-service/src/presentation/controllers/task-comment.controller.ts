// src/presentation/controllers/task-comment.controller.ts
import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, HttpStatus, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateCommentRequest } from '../dtos/create-comment.request';
import { EditCommentRequest } from '../dtos/edit-comment.request';
import { CommentResponse, GetCommentsResponse } from '../dtos/comment.response';
import { CreateCommentCommand } from '../../application/usecases/comments/create/create-comment.command';
import { EditCommentCommand } from '../../application/usecases/comments/edit/edit-comment.command';
import { DeleteCommentCommand } from '../../application/usecases/comments/delete/delete-comment.command';
import { GetTaskCommentsQuery } from '../../application/usecases/comments/get/get-task-comments.query';
import { WorkspaceValidationGuard } from '../guards/workspace-validation.guard';
import { CreateCommentResponse } from '../../application/usecases/comments/create/create-comment.handler';
import { EditCommentResponse } from '../../application/usecases/comments/edit/edit-comment.handler';
import { DeleteCommentResponse } from '../../application/usecases/comments/delete/delete-comment.handler';
import { GetTaskCommentsResponse } from '../../application/usecases/comments/get/get-task-comments.handler';

@Controller('api/v1/tasks/:taskId/comments')
@UseGuards(WorkspaceValidationGuard)
export class TaskCommentController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Create a new comment on a task
   * POST /api/v1/tasks/:taskId/comments
   */
  @Post()
  async createComment(
    @Param('taskId') taskId: string,
    @Body() request: CreateCommentRequest,
    @Req() req: any // Thêm Req vào đây để sau này lấy JWT
  ): Promise<{ statusCode: number; data: CreateCommentResponse }> {
    
    // Tạm thời mock ID người đang đăng nhập (Tương lai sẽ lấy từ req.user.id do Guard cấp)
    // Nếu hiện tại ông vẫn test chay thì cứ lấy từ request.authorId cũng được, nhưng tuyệt đối bỏ Name và Avatar
    const authorId = req?.user?.id || 'admin-001'; 

    // Khởi tạo Command với đúng 4 tham số cực kỳ gọn gàng
    const command = new CreateCommentCommand(
      taskId,
      authorId, // Truyền đúng cái ID 
      request.content,
      request.parentId || null
    );

    const result = await this.commandBus.execute(command);

    return {
      statusCode: HttpStatus.CREATED,
      data: result,
    };
  }

  /**
   * Get all comments for a task
   * GET /api/v1/tasks/:taskId/comments?skip=0&limit=20
   */
  @Get()
  async getTaskComments(
    @Param('taskId') taskId: string,
    @Query('skip') skip: string = '0',
    @Query('limit') limit: string = '20',
  ): Promise<{ statusCode: number; data: GetCommentsResponse }> {
    const query = new GetTaskCommentsQuery(
      taskId,
      parseInt(skip, 10),
      parseInt(limit, 10),
    );

    const result = await this.queryBus.execute<GetTaskCommentsQuery, GetTaskCommentsResponse>(query);

    const commentsResponse = result.comments.map(
      (comment) =>
        new CommentResponse({
          id: comment.id,
          taskId: comment.taskId,
          authorId: comment.authorId,
          authorName: comment.authorName,
          authorAvatarUrl: comment.authorAvatarUrl,
          content: comment.content,
          parentId: comment.parentId,
          mentions: comment.mentions,
          isEdited: comment.isEdited,
          isDeleted: comment.isDeleted,
          reactionCount: comment.reactionCount,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
        }),
    );

    return {
      statusCode: HttpStatus.OK,
      data: new GetCommentsResponse({
        comments: commentsResponse,
        total: result.total,
        skip: result.skip,
        limit: result.limit,
      }),
    };
  }

  /**
   * Edit an existing comment (only comment author can edit)
   * PATCH /api/v1/tasks/:taskId/comments/:commentId
   */
  @Patch(':commentId')
  async editComment(
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Body() request: EditCommentRequest,
  ): Promise<{ statusCode: number; data: EditCommentResponse }> {
    // Get authorId from request header or session
    // For now, we'll use a hardcoded value - in production, get from JWT token
    const authorId = 'user-123'; // TODO: Extract from JWT token

    const command = new EditCommentCommand(
      commentId,
      taskId,
      authorId,
      request.content,
    );

    const result = await this.commandBus.execute(command);

    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  /**
   * Delete a comment (only comment author can delete)
   * DELETE /api/v1/tasks/:taskId/comments/:commentId
   */
  @Delete(':commentId')
  async deleteComment(
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
  ): Promise<{ statusCode: number; data: DeleteCommentResponse }> {
    // Get authorId from request header or session
    // For now, we'll use a hardcoded value - in production, get from JWT token
    const authorId = 'user-123'; // TODO: Extract from JWT token

    const command = new DeleteCommentCommand(
      commentId,
      taskId,
      authorId,
    );

    const result = await this.commandBus.execute(command);

    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }
}

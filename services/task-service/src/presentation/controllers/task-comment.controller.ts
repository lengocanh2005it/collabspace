// src/presentation/controllers/task-comment.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { CreateCommentRequest } from "../dtos/create-comment.request";
import { EditCommentRequest } from "../dtos/edit-comment.request";
import { CommentResponse, GetCommentsResponse } from "../dtos/comment.response";
import { CreateCommentCommand } from "../../application/usecases/comments/create/create-comment.command";
import { EditCommentCommand } from "../../application/usecases/comments/edit/edit-comment.command";
import { DeleteCommentCommand } from "../../application/usecases/comments/delete/delete-comment.command";
import { GetTaskCommentsQuery } from "../../application/usecases/comments/get/get-task-comments.query";
import { WorkspaceValidationGuard } from "../guards/workspace-validation.guard";
import { AuthGuard } from "../guards/auth.guard";
import { CreateCommentResponse } from "../../application/usecases/comments/create/create-comment.handler";
import { EditCommentResponse } from "../../application/usecases/comments/edit/edit-comment.handler";
import { DeleteCommentResponse } from "../../application/usecases/comments/delete/delete-comment.handler";
import { GetTaskCommentsResponse } from "../../application/usecases/comments/get/get-task-comments.handler";
import type { AppRequest } from "../http/request-context";

@ApiTags("task-comments")
@ApiBearerAuth()
@Controller("tasks/:taskId/comments")
@UseGuards(AuthGuard, WorkspaceValidationGuard)
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
  @ApiOperation({ summary: "Create comment (supports @username mentions)" })
  @ApiParam({ name: "taskId" })
  async createComment(
    @Param("taskId") taskId: string,
    @Body() request: CreateCommentRequest,
    @Req() req: AppRequest,
  ): Promise<{ statusCode: number; data: CreateCommentResponse }> {
    const authorId = req.user.id;

    const command = new CreateCommentCommand(
      taskId,
      authorId,
      request.content,
      request.parentId || null,
    );

    const result = await this.commandBus.execute<
      CreateCommentCommand,
      CreateCommentResponse
    >(command);

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
  @ApiOperation({ summary: "List task comments" })
  @ApiParam({ name: "taskId" })
  @ApiQuery({ name: "skip", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async getTaskComments(
    @Param("taskId") taskId: string,
    @Query("skip") skip: string = "0",
    @Query("limit") limit: string = "20",
  ): Promise<{ statusCode: number; data: GetCommentsResponse }> {
    const query = new GetTaskCommentsQuery(
      taskId,
      parseInt(skip, 10),
      parseInt(limit, 10),
    );

    const result = await this.queryBus.execute<
      GetTaskCommentsQuery,
      GetTaskCommentsResponse
    >(query);

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
  @Patch(":commentId")
  @ApiOperation({ summary: "Edit comment (author only)" })
  @ApiParam({ name: "taskId" })
  @ApiParam({ name: "commentId" })
  async editComment(
    @Param("taskId") taskId: string,
    @Param("commentId") commentId: string,
    @Body() request: EditCommentRequest,
    @Req() req: AppRequest,
  ): Promise<{ statusCode: number; data: EditCommentResponse }> {
    const authorId = req.user.id;

    const command = new EditCommentCommand(
      commentId,
      taskId,
      authorId,
      request.content,
    );

    const result = await this.commandBus.execute<
      EditCommentCommand,
      EditCommentResponse
    >(command);

    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  /**
   * Delete a comment (only comment author can delete)
   * DELETE /api/v1/tasks/:taskId/comments/:commentId
   */
  @Delete(":commentId")
  @ApiOperation({ summary: "Soft-delete comment (author only)" })
  @ApiParam({ name: "taskId" })
  @ApiParam({ name: "commentId" })
  async deleteComment(
    @Param("taskId") taskId: string,
    @Param("commentId") commentId: string,
    @Req() req: AppRequest,
  ): Promise<{ statusCode: number; data: DeleteCommentResponse }> {
    const authorId = req.user.id;

    const command = new DeleteCommentCommand(commentId, taskId, authorId);

    const result = await this.commandBus.execute<
      DeleteCommentCommand,
      DeleteCommentResponse
    >(command);

    return {
      statusCode: HttpStatus.OK,
      data: result,
    };
  }
}

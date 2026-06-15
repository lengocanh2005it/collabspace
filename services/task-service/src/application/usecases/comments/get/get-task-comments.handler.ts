// src/application/usecases/comments/get/get-task-comments.handler.ts
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { GetTaskCommentsQuery } from "./get-task-comments.query";
import {
  type ICommentRepository,
  COMMENT_REPOSITORY_TOKEN,
} from "../../../../domain/repositories/comment.repository.interface";
import type { Comment } from "../../../../domain/entities/comment.entity";

export interface CommentResponseDto {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  parentId: string | null;
  mentions: string[];
  isEdited: boolean;
  isDeleted: boolean;
  reactionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetTaskCommentsResponse {
  comments: CommentResponseDto[];
  total: number;
  skip: number;
  limit: number;
}

@QueryHandler(GetTaskCommentsQuery)
export class GetTaskCommentsHandler
  implements IQueryHandler<GetTaskCommentsQuery, GetTaskCommentsResponse>
{
  constructor(
    @Inject(COMMENT_REPOSITORY_TOKEN)
    private readonly commentRepository: ICommentRepository,
  ) {}

  async execute(query: GetTaskCommentsQuery): Promise<GetTaskCommentsResponse> {
    const [comments, total] = await Promise.all([
      this.commentRepository.findByTaskIdAsync(query.taskId, {
        skip: query.skip,
        limit: query.limit,
      }),
      this.commentRepository.countByTaskIdAsync(query.taskId),
    ]);

    const responseComments = comments
      .filter((comment) => !comment.isDeleted())
      .map((comment) => this.mapToResponse(comment));

    return {
      comments: responseComments,
      total,
      skip: query.skip,
      limit: query.limit,
    };
  }

  private mapToResponse(comment: Comment): CommentResponseDto {
    return {
      id: comment.getId(),
      taskId: comment.getTaskId(),
      authorId: comment.getAuthorId(),
      authorName: comment.getAuthorName(),
      authorAvatarUrl: comment.getAuthorAvatarUrl(),
      content: comment.getContent(),
      parentId: comment.getParentId(),
      mentions: comment.getMentions(),
      isEdited: comment.getIsEdited(),
      isDeleted: comment.isDeleted(),
      reactionCount: comment.getReactionCount(),
      createdAt: comment.getCreatedAt(),
      updatedAt: comment.getUpdatedAt(),
    };
  }
}

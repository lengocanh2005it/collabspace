// src/infrastructure/mappers/comment.mapper.ts
import { Comment } from '../../domain/entities/comment.entity';
import { TaskCommentDocument } from '../persistence/task-comment.schema';

/**
 * Comment Mapper
 * Chuyển đổi giữa:
 * - Domain Layer: Comment entity
 * - Persistence Layer: TaskCommentDocument (MongoDB)
 * - Application Layer: DTOs (sẽ tạo ở presentation layer)
 */
export class CommentMapper {
  /**
   * Chuyển từ Domain Entity sang Persistence Document
   * Dùng khi: Save comment vào database
   */
  public static toPersistence(comment: Comment): Partial<TaskCommentDocument> {
    return {
      taskId: comment.getTaskId(),
      authorId: comment.getAuthorId(),
      authorName: comment.getAuthorName(),
      authorAvatarUrl: comment.getAuthorAvatarUrl(),
      content: comment.getContent(),
      parentId: comment.getParentId(),
      mentions: comment.getMentions(),
      isEdited: comment.getIsEdited(),
      deletedAt: comment.getDeletedAt(),
      reactionCount: comment.getReactionCount(),
      createdAt: comment.getCreatedAt(),
      updatedAt: comment.getUpdatedAt(),
    };
  }

  /**
   * Chuyển từ Persistence Document sang Domain Entity
   * Dùng khi: Fetch comment từ database
   */
  public static toDomain(raw: TaskCommentDocument): Comment {
    return Comment.restore(
      raw._id.toString(),
      raw.taskId,
      raw.authorId,
      raw.authorName,
      raw.authorAvatarUrl,
      raw.content,
      raw.parentId || null,
      raw.mentions,
      raw.isEdited,
      raw.deletedAt || null,
      raw.reactionCount,
      raw.createdAt,
      raw.updatedAt,
    );
  }

  /**
   * Chuyển từ Persistence Document sang DTO (Response)
   * Dùng khi: Gửi response về client
   * Sẽ được gọi từ presentation layer
   */
  public static toResponse(raw: TaskCommentDocument): any {
    return {
      id: raw._id.toString(),
      taskId: raw.taskId,
      author: {
        id: raw.authorId,
        name: raw.authorName,
        avatarUrl: raw.authorAvatarUrl,
      },
      content: raw.content,
      parentId: raw.parentId,
      mentions: raw.mentions,
      isEdited: raw.isEdited,
      reactionCount: raw.reactionCount,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  /**
   * Chuyển collection Document sang DTOs
   */
  public static toResponses(comments: TaskCommentDocument[]): any[] {
    return comments.map((comment) => this.toResponse(comment));
  }
}

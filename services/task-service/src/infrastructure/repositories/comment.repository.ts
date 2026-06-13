// src/infrastructure/repositories/comment.repository.ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ICommentRepository } from "../../domain/repositories/comment.repository.interface";
import { Comment } from "../../domain/entities/comment.entity";
import {
  TaskComment,
  TaskCommentDocument,
} from "../persistence/task-comment.schema";
import { CommentMapper } from "../mappers/comment.mapper";
import { CommentSpecs } from "../../domain/specifications/comment.specifications";

/**
 * Comment Repository - Infrastructure Layer Adapter
 * Chuyển đổi giữa Domain Entity (Comment) và MongoDB Document (TaskComment)
 * Kế thừa ICommentRepository port từ Domain Layer
 */
@Injectable()
export class CommentRepository implements ICommentRepository {
  constructor(
    @InjectModel(TaskComment.name)
    private readonly commentModel: Model<TaskCommentDocument>,
  ) {}

  /**
   * Tạo comment mới trong database
   */
  async createAsync(comment: Comment): Promise<string> {
    const commentDocument = CommentMapper.toPersistence(comment);
    const createdComment = await this.commentModel.create(commentDocument);
    return createdComment._id.toString();
  }

  /**
   * Tìm comment theo ID (không bao gồm deleted)
   */
  async findByIdAsync(id: string): Promise<Comment | null> {
    const document = await this.commentModel.findOne({
      _id: id,
      ...CommentSpecs.notDeleted,
    });

    if (!document) {
      return null;
    }

    return CommentMapper.toDomain(document);
  }

  /**
   * Tìm tất cả comment của một task (parent comments only, không bao gồm replies)
   */
  async findByTaskIdAsync(
    taskId: string,
    options?: { skip?: number; limit?: number },
  ): Promise<Comment[]> {
    const query = CommentSpecs.topLevelForTask(taskId);

    let queryBuilder = this.commentModel.find(query).sort({ createdAt: -1 });

    if (options?.skip) {
      queryBuilder = queryBuilder.skip(options.skip);
    }

    if (options?.limit) {
      queryBuilder = queryBuilder.limit(options.limit);
    }

    const documents = await queryBuilder.exec();
    return documents.map((doc) => CommentMapper.toDomain(doc));
  }

  /**
   * Tìm tất cả reply của một parent comment
   */
  async findRepliesByParentIdAsync(
    parentId: string,
    options?: { skip?: number; limit?: number },
  ): Promise<Comment[]> {
    const query = CommentSpecs.repliesOf(parentId);

    let queryBuilder = this.commentModel.find(query).sort({ createdAt: 1 });

    if (options?.skip) {
      queryBuilder = queryBuilder.skip(options.skip);
    }

    if (options?.limit) {
      queryBuilder = queryBuilder.limit(options.limit);
    }

    const documents = await queryBuilder.exec();
    return documents.map((doc) => CommentMapper.toDomain(doc));
  }

  /**
   * Tìm comment của task kèm replies (tree structure)
   * Aggregate pipeline để load parent comments + replies cùng lúc
   */
  async findTaskCommentsWithRepliesAsync(taskId: string): Promise<Comment[]> {
    const parentComments = await this.commentModel.find(
      CommentSpecs.topLevelForTask(taskId),
    );

    // For each parent comment, fetch replies
    const commentsWithReplies: Comment[] = [];

    for (const parentDoc of parentComments) {
      const parentComment = CommentMapper.toDomain(parentDoc);
      commentsWithReplies.push(parentComment);

      // Fetch replies for this parent
      const replies = await this.findRepliesByParentIdAsync(
        parentDoc._id.toString(),
      );
      commentsWithReplies.push(...replies);
    }

    return commentsWithReplies;
  }

  /**
   * Cập nhật comment
   */
  async updateAsync(comment: Comment): Promise<boolean> {
    const commentData = CommentMapper.toPersistence(comment);

    const result = await this.commentModel.updateOne(
      { _id: comment.getId() },
      {
        $set: {
          content: commentData.content,
          mentions: commentData.mentions,
          isEdited: commentData.isEdited,
          deletedAt: commentData.deletedAt,
          reactionCount: commentData.reactionCount,
          updatedAt: commentData.updatedAt,
        },
      },
    );

    return result.modifiedCount > 0;
  }

  /**
   * Xóa comment vật lý (hard delete)
   */
  async deleteAsync(id: string): Promise<boolean> {
    const result = await this.commentModel.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  /**
   * Tìm comment có mention đến user (cho notification)
   */
  async findCommentsMentioningUserAsync(
    userId: string,
    options?: { skip?: number; limit?: number },
  ): Promise<Comment[]> {
    const query = {
      mentions: userId,
      ...CommentSpecs.notDeleted,
    };

    let queryBuilder = this.commentModel.find(query).sort({ createdAt: -1 });

    if (options?.skip) {
      queryBuilder = queryBuilder.skip(options.skip);
    }

    if (options?.limit) {
      queryBuilder = queryBuilder.limit(options.limit);
    }

    const documents = await queryBuilder.exec();
    return documents.map((doc) => CommentMapper.toDomain(doc));
  }

  /**
   * Đếm comment của task (không bao gồm deleted)
   */
  async countByTaskIdAsync(taskId: string): Promise<number> {
    return this.commentModel.countDocuments(CommentSpecs.topLevelForTask(taskId));
  }

  /**
   * Đếm reply của parent comment
   */
  async countRepliesByParentIdAsync(parentId: string): Promise<number> {
    return this.commentModel.countDocuments(CommentSpecs.repliesOf(parentId));
  }

  /**
   * Xóa tất cả comment của task (khi task bị xóa)
   * Sử dụng soft-delete bằng cách set deletedAt
   */
  async deleteByTaskIdAsync(taskId: string): Promise<number> {
    const result = await this.commentModel.updateMany(
      { taskId },
      { $set: { deletedAt: new Date() } },
    );

    return result.modifiedCount;
  }
}

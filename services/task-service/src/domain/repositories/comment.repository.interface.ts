// src/domain/repositories/comment.repository.interface.ts
import type { Comment } from "../entities/comment.entity";

/**
 * Comment Repository Interface (Port)
 * Định nghĩa contract cho persistence layer
 * Không phụ thuộc vào MongoDB, có thể implement với bất kỳ storage nào
 */
export interface ICommentRepository {
  /**
   * Tạo comment mới
   * @param comment Comment entity từ domain layer
   * @returns ID của comment được tạo
   */
  createAsync(comment: Comment): Promise<string>;

  /**
   * Tìm comment theo ID
   * @param id Comment ID
   * @returns Comment entity hoặc null nếu không tìm thấy
   */
  findByIdAsync(id: string): Promise<Comment | null>;

  /**
   * Tìm tất cả comment của một task (không bao gồm deleted)
   * @param taskId Task ID
   * @param options Tùy chọn pagination
   * @returns Mảng Comment entities
   */
  findByTaskIdAsync(
    taskId: string,
    options?: { skip?: number; limit?: number },
  ): Promise<Comment[]>;

  /**
   * Tìm tất cả reply của một parent comment
   * @param parentId Parent comment ID
   * @param options Tùy chọn pagination
   * @returns Mảng Comment entities (replies)
   */
  findRepliesByParentIdAsync(
    parentId: string,
    options?: { skip?: number; limit?: number },
  ): Promise<Comment[]>;

  /**
   * Tìm tất cả comment của một task kèm replies (tree structure)
   * @param taskId Task ID
   * @returns Mảng parent comments với embedded replies
   */
  findTaskCommentsWithRepliesAsync(taskId: string): Promise<Comment[]>;

  /**
   * Cập nhật comment
   * @param comment Comment entity với các thay đổi
   * @returns boolean - true nếu update thành công
   */
  updateAsync(comment: Comment): Promise<boolean>;

  /**
   * Xóa comment vật lý (hard delete)
   * @param id Comment ID
   * @returns boolean - true nếu delete thành công
   */
  deleteAsync(id: string): Promise<boolean>;

  /**
   * Tìm tất cả comment có mention đến user (cho notification)
   * @param userId User ID
   * @param options Tùy chọn pagination
   * @returns Mảng Comment entities có mention user này
   */
  findCommentsMentioningUserAsync(
    userId: string,
    options?: { skip?: number; limit?: number },
  ): Promise<Comment[]>;

  /**
   * Đếm số comment của một task (không bao gồm deleted)
   * @param taskId Task ID
   * @returns Số lượng comment
   */
  countByTaskIdAsync(taskId: string): Promise<number>;

  countByTaskIdsAsync(taskIds: string[]): Promise<Map<string, number>>;

  /**
   * Đếm số reply của một parent comment
   * @param parentId Parent comment ID
   * @returns Số lượng reply
   */
  countRepliesByParentIdAsync(parentId: string): Promise<number>;

  /**
   * Xóa tất cả comment của một task (khi task bị xóa)
   * @param taskId Task ID
   * @returns Số comment bị xóa
   */
  deleteByTaskIdAsync(taskId: string): Promise<number>;
}

export const COMMENT_REPOSITORY_TOKEN = "ICommentRepository";

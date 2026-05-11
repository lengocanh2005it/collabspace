// src/domain/entities/comment.entity.ts
import { BusinessRuleException } from '../exceptions/BusinessRuleException';

/**
 * Comment Domain Entity
 * Chứa toàn bộ business logic liên quan đến bình luận
 * Không phụ thuộc vào Mongoose hay bất kỳ infrastructure nào
 */
export class Comment {
  private constructor(
    private readonly id: string,
    private readonly taskId: string,
    private readonly authorId: string,
    private authorName: string,
    private authorAvatarUrl: string | undefined,
    private content: string,
    private readonly parentId: string | null,
    private mentions: string[],
    private isEdited: boolean,
    private deletedAt: Date | null,
    private reactionCount: number,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  /**
   * Factory method để tạo comment mới
   */
  public static create(
    id: string,
    taskId: string,
    authorId: string,
    authorName: string,
    authorAvatarUrl: string | undefined,
    content: string,
    parentId: string | null = null,
  ): Comment {
    if (!content || content.trim().length === 0) {
      throw new BusinessRuleException('Comment content cannot be empty');
    }

    if (content.length > 5000) {
      throw new BusinessRuleException('Comment content exceeds maximum length of 5000 characters');
    }

    if (!authorId) {
      throw new BusinessRuleException('Author ID is required');
    }

    return new Comment(
      id,
      taskId,
      authorId,
      authorName,
      authorAvatarUrl,
      content,
      parentId,
      [],
      false,
      null,
      0,
      new Date(),
      new Date(),
    );
  }

  /**
   * Factory method để restore comment từ database
   */
  public static restore(
    id: string,
    taskId: string,
    authorId: string,
    authorName: string,
    authorAvatarUrl: string | undefined,
    content: string,
    parentId: string | null,
    mentions: string[],
    isEdited: boolean,
    deletedAt: Date | null,
    reactionCount: number,
    createdAt: Date,
    updatedAt: Date,
  ): Comment {
    return new Comment(
      id,
      taskId,
      authorId,
      authorName,
      authorAvatarUrl,
      content,
      parentId,
      mentions,
      isEdited,
      deletedAt,
      reactionCount,
      createdAt,
      updatedAt,
    );
  }

  /**
   * Cập nhật nội dung bình luận
   */
  public updateContent(newContent: string): void {
    if (this.isDeleted()) {
      throw new BusinessRuleException('Cannot edit a deleted comment');
    }

    if (!newContent || newContent.trim().length === 0) {
      throw new BusinessRuleException('Comment content cannot be empty');
    }

    if (newContent.length > 5000) {
      throw new BusinessRuleException('Comment content exceeds maximum length of 5000 characters');
    }

    this.content = newContent;
    this.isEdited = true;
    this.updatedAt = new Date();
  }

  /**
   * Đánh dấu comment là đã bị xóa (soft delete)
   */
  public markAsDeleted(): void {
    if (this.isDeleted()) {
      throw new BusinessRuleException('Comment is already deleted');
    }

    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Khôi phục comment đã xóa
   */
  public restore(): void {
    if (!this.isDeleted()) {
      throw new BusinessRuleException('Comment is not deleted');
    }

    this.deletedAt = null;
    this.updatedAt = new Date();
  }

  /**
   * Thêm mention cho user
   */
  public addMention(userId: string): void {
    if (this.isDeleted()) {
      throw new BusinessRuleException('Cannot mention in a deleted comment');
    }

    if (this.mentions.includes(userId)) {
      throw new BusinessRuleException('User is already mentioned in this comment');
    }

    this.mentions.push(userId);
    this.updatedAt = new Date();
  }

  /**
   * Xóa mention của user
   */
  public removeMention(userId: string): void {
    if (this.isDeleted()) {
      throw new BusinessRuleException('Cannot remove mention from a deleted comment');
    }

    const index = this.mentions.indexOf(userId);
    if (index === -1) {
      throw new BusinessRuleException('User is not mentioned in this comment');
    }

    this.mentions.splice(index, 1);
    this.updatedAt = new Date();
  }

  /**
   * Tăng reaction count (like, love, etc)
   */
  public incrementReactionCount(): void {
    if (this.isDeleted()) {
      throw new BusinessRuleException('Cannot react to a deleted comment');
    }

    this.reactionCount++;
    this.updatedAt = new Date();
  }

  /**
   * Giảm reaction count
   */
  public decrementReactionCount(): void {
    if (this.isDeleted()) {
      throw new BusinessRuleException('Cannot remove reaction from a deleted comment');
    }

    if (this.reactionCount > 0) {
      this.reactionCount--;
      this.updatedAt = new Date();
    }
  }

  /**
   * Kiểm tra comment đã bị xóa hay chưa
   */
  public isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  /**
   * Kiểm tra comment có phải reply hay không
   */
  public isReply(): boolean {
    return this.parentId !== null;
  }

  /**
   * Kiểm tra comment có phải owner không
   */
  public isOwnedBy(userId: string): boolean {
    return this.authorId === userId;
  }

  // ========================================================
  // GETTERS - Immutable property access
  // ========================================================
  public getId(): string {
    return this.id;
  }

  public getTaskId(): string {
    return this.taskId;
  }

  public getAuthorId(): string {
    return this.authorId;
  }

  public getAuthorName(): string {
    return this.authorName;
  }

  public getAuthorAvatarUrl(): string | undefined {
    return this.authorAvatarUrl;
  }

  public getContent(): string {
    return this.content;
  }

  public getParentId(): string | null {
    return this.parentId;
  }

  public getMentions(): string[] {
    return [...this.mentions]; // Return copy to prevent external modification
  }

  public getIsEdited(): boolean {
    return this.isEdited;
  }

  public getDeletedAt(): Date | null {
    return this.deletedAt;
  }

  public getReactionCount(): number {
    return this.reactionCount;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}

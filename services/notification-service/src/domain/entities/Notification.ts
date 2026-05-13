// src/domain/entities/Notification.ts
import { NotificationType } from "../value-objects/NotificationType";
import { NotificationStatus } from "../value-objects/NotificationStatus";
import { randomUUID } from "node:crypto";
import type { NotificationMetadata } from "../types/notification-metadata";

/**
 * Notification Domain Entity
 * Chứa toàn bộ business logic liên quan đến thông báo
 * Không phụ thuộc vào Mongoose hay bất kỳ framework nào
 */
export class Notification {
  private constructor(
    private readonly id: string,
    private readonly recipientId: string, // User ID của người nhận
    private readonly actorId: string, // User ID của người tạo hành động
    private readonly type: NotificationType,
    private readonly title: string,
    private readonly message: string,
    private readonly targetId: string, // ID của resource (taskId, commentId, etc)
    private readonly targetType: string, // Loại resource (TASK, COMMENT, etc)
    private status: NotificationStatus,
    private readonly metadata: NotificationMetadata, // Dữ liệu thêm (actorName, actorAvatar, etc)
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  /**
   * Factory method để tạo thông báo mới
   */
  public static create(
    recipientId: string,
    actorId: string,
    type: NotificationType,
    title: string,
    message: string,
    targetId: string,
    targetType: string,
    metadata?: NotificationMetadata,
  ): Notification {
    // Validation
    if (!recipientId || !recipientId.trim()) {
      throw new Error("Recipient ID is required");
    }
    if (!actorId || !actorId.trim()) {
      throw new Error("Actor ID is required");
    }
    if (!title || !title.trim()) {
      throw new Error("Title is required");
    }
    if (!message || !message.trim()) {
      throw new Error("Message is required");
    }
    if (!targetId || !targetId.trim()) {
      throw new Error("Target ID is required");
    }
    if (!targetType || !targetType.trim()) {
      throw new Error("Target Type is required");
    }

    return new Notification(
      randomUUID(),
      recipientId,
      actorId,
      type,
      title,
      message,
      targetId,
      targetType,
      NotificationStatus.UNREAD,
      metadata ?? {},
      new Date(),
      new Date(),
    );
  }

  /**
   * Factory method để restore notification từ database
   */
  public static restore(
    id: string,
    recipientId: string,
    actorId: string,
    type: NotificationType,
    title: string,
    message: string,
    targetId: string,
    targetType: string,
    status: NotificationStatus,
    metadata: NotificationMetadata,
    createdAt: Date,
    updatedAt: Date,
  ): Notification {
    return new Notification(
      id,
      recipientId,
      actorId,
      type,
      title,
      message,
      targetId,
      targetType,
      status,
      metadata,
      createdAt,
      updatedAt,
    );
  }

  /**
   * Đánh dấu thông báo đã đọc
   */
  public markAsRead(): void {
    if (this.status === NotificationStatus.READ) {
      throw new Error("Notification is already read");
    }
    this.status = NotificationStatus.READ;
    this.updatedAt = new Date();
  }

  /**
   * Đánh dấu thông báo chưa đọc
   */
  public markAsUnread(): void {
    if (this.status === NotificationStatus.UNREAD) {
      throw new Error("Notification is already unread");
    }
    this.status = NotificationStatus.UNREAD;
    this.updatedAt = new Date();
  }

  /**
   * Lưu trữ thông báo
   */
  public archive(): void {
    if (this.status === NotificationStatus.ARCHIVED) {
      throw new Error("Notification is already archived");
    }
    this.status = NotificationStatus.ARCHIVED;
    this.updatedAt = new Date();
  }

  /**
   * Kiểm tra thông báo có chưa đọc không
   */
  public isUnread(): boolean {
    return this.status === NotificationStatus.UNREAD;
  }

  /**
   * Kiểm tra thông báo có được đọc không
   */
  public isRead(): boolean {
    return this.status === NotificationStatus.READ;
  }

  // ========================================================
  // GETTERS - Immutable property access
  // ========================================================
  public getId(): string {
    return this.id;
  }

  public getRecipientId(): string {
    return this.recipientId;
  }

  public getActorId(): string {
    return this.actorId;
  }

  public getType(): NotificationType {
    return this.type;
  }

  public getTitle(): string {
    return this.title;
  }

  public getMessage(): string {
    return this.message;
  }

  public getTargetId(): string {
    return this.targetId;
  }

  public getTargetType(): string {
    return this.targetType;
  }

  public getStatus(): NotificationStatus {
    return this.status;
  }

  public getMetadata(): NotificationMetadata {
    return { ...this.metadata };
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}

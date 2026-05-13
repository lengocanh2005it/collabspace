// src/infrastructure/mappers/notification.mapper.ts
import { Notification as NotificationEntity } from "../../domain/entities/Notification";
import { NotificationDocument } from "../database/schemas/notification.schema";
import { NotificationStatus } from "../../domain/value-objects/NotificationStatus";

/**
 * Notification Mapper
 * Chuyển đổi giữa:
 * - Domain Layer: Notification entity
 * - Persistence Layer: NotificationDocument (MongoDB)
 */
export class NotificationMapper {
  /**
   * Chuyển từ Domain Entity sang Persistence Document
   * Dùng khi: Save notification vào database
   */
  public static toPersistence(
    notification: NotificationEntity,
  ): Partial<NotificationDocument> {
    return {
      recipientId: notification.getRecipientId(),
      actorId: notification.getActorId(),
      type: notification.getType(),
      title: notification.getTitle(),
      message: notification.getMessage(),
      targetId: notification.getTargetId(),
      targetType: notification.getTargetType(),
      status: notification.getStatus(),
      metadata: notification.getMetadata(),
      createdAt: notification.getCreatedAt(),
      updatedAt: notification.getUpdatedAt(),
    };
  }

  /**
   * Chuyển từ Persistence Document sang Domain Entity
   * Dùng khi: Fetch notification từ database
   */
  public static toDomain(raw: NotificationDocument): NotificationEntity {
    return NotificationEntity.restore(
      raw._id.toString(),
      raw.recipientId,
      raw.actorId,
      raw.type,
      raw.title,
      raw.message,
      raw.targetId,
      raw.targetType,
      raw.status,
      raw.metadata,
      raw.createdAt,
      raw.updatedAt,
    );
  }

  /**
   * Chuyển từ Persistence Document sang Response DTO
   * Dùng khi: Gửi response về client
   */
  public static toResponse(raw: NotificationDocument): any {
    return {
      id: raw._id.toString(),
      recipientId: raw.recipientId,
      actor: {
        id: raw.actorId,
        name: raw.metadata?.actorName || "Unknown",
        avatarUrl: raw.metadata?.actorAvatarUrl,
      },
      type: raw.type,
      title: raw.title,
      message: raw.message,
      targetId: raw.targetId,
      targetType: raw.targetType,
      status: raw.status,
      metadata: raw.metadata,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  /**
   * Chuyển collection Document sang DTOs
   */
  public static toResponses(notifications: NotificationDocument[]): any[] {
    return notifications.map((notification) => this.toResponse(notification));
  }
}

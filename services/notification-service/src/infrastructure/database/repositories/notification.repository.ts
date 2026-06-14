// src/infrastructure/database/repositories/notification.repository.ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Notification as NotificationEntity } from "../../../domain/entities/Notification";
import { INotificationRepository } from "../../../domain/repositories/INotificationRepository";
import {
  Notification,
  NotificationDocument,
} from "../schemas/notification.schema";
import { NotificationMapper } from "../../mappers/notification.mapper";
import { NotificationStatus } from "../../../domain/value-objects/NotificationStatus";
import { NotificationType } from "../../../domain/value-objects/NotificationType";

/**
 * Notification Repository - Infrastructure Layer Adapter
 * Chuyển đổi giữa Domain Entity (Notification) và MongoDB Document
 * Kế thừa INotificationRepository port từ Domain Layer
 */
@Injectable()
export class NotificationRepository implements INotificationRepository {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  /**
   * Tạo notification mới trong database
   */
  async createAsync(notification: NotificationEntity): Promise<string> {
    const notificationDocument = NotificationMapper.toPersistence(notification);
    const createdNotification =
      await this.notificationModel.create(notificationDocument);
    return createdNotification._id.toString();
  }

  async createBroadcastAsync(
    notification: NotificationEntity,
    dedupeKey: string,
  ): Promise<boolean> {
    const notificationDocument = NotificationMapper.toPersistence(notification);
    const result = await this.notificationModel.updateOne(
      { broadcastDedupeKey: dedupeKey },
      {
        $setOnInsert: {
          ...notificationDocument,
          broadcastDedupeKey: dedupeKey,
        },
      },
      { upsert: true },
    );

    return result.upsertedCount > 0;
  }

  /**
   * Tìm notification theo ID
   */
  async findByIdAsync(id: string): Promise<NotificationEntity | null> {
    const document = await this.notificationModel.findById(id).lean().exec();
    if (!document) {
      return null;
    }
    return NotificationMapper.toDomain(document as any);
  }

  /**
   * Tìm tất cả notification của một user (với pagination)
   */
  async findByRecipientIdAsync(
    recipientId: string,
    options?: { skip?: number; limit?: number },
  ): Promise<NotificationEntity[]> {
    let query = this.notificationModel
      .find({ recipientId })
      .sort({ createdAt: -1 });

    if (options?.skip) {
      query = query.skip(options.skip);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const documents = await query.lean().exec();
    return documents.map((doc) => NotificationMapper.toDomain(doc as any));
  }

  /**
   * Tìm notification chưa đọc của một user
   */
  async findUnreadByRecipientIdAsync(
    recipientId: string,
  ): Promise<NotificationEntity[]> {
    const documents = await this.notificationModel
      .find({
        recipientId,
        status: NotificationStatus.UNREAD,
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return documents.map((doc) => NotificationMapper.toDomain(doc as any));
  }

  /**
   * Đếm số notification chưa đọc của một user
   */
  async countUnreadByRecipientIdAsync(recipientId: string): Promise<number> {
    return await this.notificationModel.countDocuments({
      recipientId,
      status: NotificationStatus.UNREAD,
    });
  }

  async countByRecipientIdAsync(recipientId: string): Promise<number> {
    return this.notificationModel.countDocuments({ recipientId });
  }

  /**
   * Cập nhật notification
   */
  async updateAsync(notification: NotificationEntity): Promise<boolean> {
    const notificationDocument = NotificationMapper.toPersistence(notification);
    const result = await this.notificationModel.updateOne(
      { _id: notification.getId() },
      notificationDocument,
    );

    return result.modifiedCount > 0;
  }

  /**
   * Xóa notification
   */
  async deleteAsync(id: string): Promise<boolean> {
    const result = await this.notificationModel.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  /**
   * Đánh dấu tất cả notification của user là đã đọc
   */
  async markAllAsReadAsync(recipientId: string): Promise<number> {
    const BATCH_SIZE = 1000;
    let totalModified = 0;

    while (true) {
      const ids = await this.notificationModel
        .find({ recipientId, status: NotificationStatus.UNREAD })
        .select('_id')
        .limit(BATCH_SIZE)
        .lean()
        .exec();

      if (ids.length === 0) break;

      const result = await this.notificationModel.updateMany(
        { _id: { $in: ids.map((d: any) => d._id) } },
        { status: NotificationStatus.READ, updatedAt: new Date() },
      );

      totalModified += result.modifiedCount;

      if (ids.length < BATCH_SIZE) break;
    }

    return totalModified;
  }

  /**
   * Tìm notification theo type
   */
  async findByTypeAsync(
    recipientId: string,
    type: NotificationType,
  ): Promise<NotificationEntity[]> {
    const documents = await this.notificationModel
      .find({
        recipientId: recipientId,
        type: type,
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return documents.map((doc) => NotificationMapper.toDomain(doc as any));
  }

  /**
   * Xóa các notification cũ (hơn N ngày)
   */
  async deleteOldNotificationsAsync(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.notificationModel.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    return result.deletedCount;
  }
}

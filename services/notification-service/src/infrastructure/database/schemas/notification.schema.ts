// src/infrastructure/database/schemas/notification.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NotificationType } from '../../../domain/value-objects/NotificationType';
import { NotificationStatus } from '../../../domain/value-objects/NotificationStatus';

export type NotificationDocument = Notification & Document;

@Schema({ collection: 'notifications', timestamps: true })
export class Notification {
  @Prop({ type: String, required: true, index: true })
  recipientId!: string; // User ID của người nhận thông báo

  @Prop({ type: String, required: true })
  actorId!: string; // User ID của người tạo hành động

  @Prop({ type: String, required: true, enum: Object.values(NotificationType) })
  type!: NotificationType; // Loại thông báo

  @Prop({ type: String, required: true })
  title!: string; // Tiêu đề ngắn

  @Prop({ type: String, required: true })
  message!: string; // Nội dung thông báo

  @Prop({ type: String, required: true, index: true })
  targetId!: string; // ID của resource (taskId, commentId, workspaceId, etc)

  @Prop({ type: String, required: true })
  targetType!: string; // Loại resource (TASK, COMMENT, WORKSPACE, etc)

  @Prop({ type: String, required: true, enum: Object.values(NotificationStatus), default: NotificationStatus.UNREAD })
  status!: NotificationStatus; // Trạng thái: UNREAD, READ, ARCHIVED

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, any>; // Metadata thêm (actorName, actorAvatar, taskPriority, etc)

  @Prop({ type: Date, default: () => new Date() })
  createdAt!: Date;

  @Prop({ type: Date, default: () => new Date() })
  updatedAt!: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Index để tìm nhanh notification của user
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

// Index để tìm notification chưa đọc nhanh chóng
NotificationSchema.index({ recipientId: 1, status: 1 });

// Index để delete notification cũ
NotificationSchema.index({ createdAt: 1 });

// Index cho targetId để có thể query theo resource
NotificationSchema.index({ targetId: 1, targetType: 1 });

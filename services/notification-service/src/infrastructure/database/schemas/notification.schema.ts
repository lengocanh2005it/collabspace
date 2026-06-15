import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";
import type { NotificationMetadata } from "../../../domain/types/notification-metadata";
import { NotificationStatus } from "../../../domain/value-objects/NotificationStatus";
import { NotificationType } from "../../../domain/value-objects/NotificationType";

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ collection: "notifications", timestamps: true })
export class Notification {
  @Prop({ type: String, required: true, index: true })
  recipientId!: string;

  @Prop({ type: String, required: true })
  actorId!: string;

  @Prop({ type: String, required: true, enum: Object.values(NotificationType) })
  type!: NotificationType;

  @Prop({ type: String, required: true })
  title!: string;

  @Prop({ type: String, required: true })
  message!: string;

  @Prop({ type: String, required: true, index: true })
  targetId!: string;

  @Prop({ type: String, required: true })
  targetType!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(NotificationStatus),
    default: NotificationStatus.UNREAD,
  })
  status!: NotificationStatus;

  @Prop({ type: Object, default: {} })
  metadata!: NotificationMetadata;

  @Prop({ type: String, required: false })
  broadcastDedupeKey?: string;

  @Prop({ type: Date, default: () => new Date() })
  createdAt!: Date;

  @Prop({ type: Date, default: () => new Date() })
  updatedAt!: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, status: 1 });
NotificationSchema.index({ createdAt: 1 });
NotificationSchema.index({ targetId: 1, targetType: 1 });
NotificationSchema.index({ broadcastDedupeKey: 1 }, { unique: true, sparse: true });

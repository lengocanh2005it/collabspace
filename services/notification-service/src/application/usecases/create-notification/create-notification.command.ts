// src/application/usecases/create-notification/create-notification.command.ts
import { NotificationType } from "../../../domain/value-objects/NotificationType";
import type { NotificationMetadata } from "../../../domain/types/notification-metadata";

export class CreateNotificationCommand {
  constructor(
    public readonly recipientId: string,
    public readonly actorId: string,
    public readonly type: NotificationType,
    public readonly title: string,
    public readonly message: string,
    public readonly targetId: string,
    public readonly targetType: string,
    public readonly metadata?: NotificationMetadata,
    public readonly eventId?: string,
  ) {}
}

import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Inject, NotFoundException, ForbiddenException } from "@nestjs/common";
import { MarkNotificationReadCommand } from "./mark-notification-read.command";
import {
  NOTIFICATION_REPOSITORY_TOKEN,
  type INotificationRepository,
} from "../../../domain/repositories/INotificationRepository";
import type { NotificationCountCacheService } from "../../../infrastructure/cache/notification-count-cache.service";

@CommandHandler(MarkNotificationReadCommand)
export class MarkNotificationReadHandler
  implements ICommandHandler<MarkNotificationReadCommand, void>
{
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
    private readonly countCache: NotificationCountCacheService,
  ) {}

  async execute(command: MarkNotificationReadCommand): Promise<void> {
    const notification = await this.notificationRepository.findByIdAsync(command.notificationId);

    if (!notification) {
      throw new NotFoundException({
        code: "NOTIFICATION_NOT_FOUND",
        message: "Notification not found",
      });
    }

    if (notification.getRecipientId() !== command.recipientId) {
      throw new ForbiddenException({
        code: "NOTIFICATION_FORBIDDEN",
        message: "You cannot modify this notification",
      });
    }

    if (!notification.isRead()) {
      notification.markAsRead();
      await this.notificationRepository.updateAsync(notification);
      await this.countCache.invalidateUnreadCount(command.recipientId);
    }
  }
}

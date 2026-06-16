import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { ForbiddenException, Inject, NotFoundException } from "@nestjs/common";
import { MarkNotificationArchiveCommand } from "./mark-notification-archive.command";
import {
  NOTIFICATION_REPOSITORY_TOKEN,
  type INotificationRepository,
} from "../../../domain/repositories/INotificationRepository";
import { NotificationStatus } from "../../../domain/value-objects/NotificationStatus";
import { NotificationCountCacheService } from "../../../infrastructure/cache/notification-count-cache.service";

@CommandHandler(MarkNotificationArchiveCommand)
export class MarkNotificationArchiveHandler
  implements ICommandHandler<MarkNotificationArchiveCommand, void>
{
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
    private readonly countCache: NotificationCountCacheService,
  ) {}

  async execute(command: MarkNotificationArchiveCommand): Promise<void> {
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

    if (notification.getStatus() !== NotificationStatus.ARCHIVED) {
      const wasUnread = notification.isUnread();
      notification.archive();
      await this.notificationRepository.updateAsync(notification);
      if (wasUnread) {
        await this.countCache.invalidateUnreadCount(command.recipientId);
      }
    }
  }
}

import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { MarkAllNotificationsReadCommand } from "./mark-all-notifications-read.command";
import {
  NOTIFICATION_REPOSITORY_TOKEN,
  type INotificationRepository,
} from "../../../domain/repositories/INotificationRepository";
import { NotificationCountCacheService } from "../../../infrastructure/cache/notification-count-cache.service";

@CommandHandler(MarkAllNotificationsReadCommand)
export class MarkAllNotificationsReadHandler
  implements ICommandHandler<MarkAllNotificationsReadCommand, { updatedCount: number }>
{
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
    private readonly countCache: NotificationCountCacheService,
  ) {}

  async execute(command: MarkAllNotificationsReadCommand): Promise<{ updatedCount: number }> {
    const updatedCount = await this.notificationRepository.markAllAsReadAsync(command.recipientId);

    await this.countCache.invalidateUnreadCount(command.recipientId);

    return { updatedCount };
  }
}

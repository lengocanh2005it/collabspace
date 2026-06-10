import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { MarkAllNotificationsReadCommand } from "./mark-all-notifications-read.command";
import {
  NOTIFICATION_REPOSITORY_TOKEN,
  type INotificationRepository,
} from "../../../domain/repositories/INotificationRepository";

@CommandHandler(MarkAllNotificationsReadCommand)
export class MarkAllNotificationsReadHandler implements ICommandHandler<
  MarkAllNotificationsReadCommand,
  { updatedCount: number }
> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(
    command: MarkAllNotificationsReadCommand,
  ): Promise<{ updatedCount: number }> {
    const updatedCount =
      await this.notificationRepository.markAllAsReadAsync(
        command.recipientId,
      );

    return { updatedCount };
  }
}

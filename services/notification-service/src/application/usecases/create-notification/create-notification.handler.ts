// src/application/usecases/create-notification/create-notification.handler.ts
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { CreateNotificationCommand } from "./create-notification.command";
import { Notification } from "../../../domain/entities/Notification";
import {
  type INotificationRepository,
  NOTIFICATION_REPOSITORY_TOKEN,
} from "../../../domain/repositories/INotificationRepository";
import {
  type IProcessedEventRepository,
  PROCESSED_EVENT_REPOSITORY_TOKEN,
} from "../../../domain/repositories/IProcessedEventRepository";
import { NotificationCountCacheService } from "../../../infrastructure/cache/notification-count-cache.service";

export interface CreateNotificationResponse {
  notificationId: string;
  message: string;
}

@CommandHandler(CreateNotificationCommand)
export class CreateNotificationHandler implements ICommandHandler<
  CreateNotificationCommand,
  CreateNotificationResponse
> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
    @Inject(PROCESSED_EVENT_REPOSITORY_TOKEN)
    private readonly processedEventRepository: IProcessedEventRepository,
    private readonly countCache: NotificationCountCacheService,
  ) {}

  async execute(
    command: CreateNotificationCommand,
  ): Promise<CreateNotificationResponse> {
    if (command.eventId) {
      const claimed = await this.processedEventRepository.tryClaim(
        command.eventId,
      );

      if (!claimed) {
        return {
          notificationId: "",
          message: "Notification already processed for event",
        };
      }
    }

    const notification = Notification.create(
      command.recipientId,
      command.actorId,
      command.type,
      command.title,
      command.message,
      command.targetId,
      command.targetType,
      command.metadata,
    );

    const savedNotificationId =
      await this.notificationRepository.createAsync(notification);

    // New unread notification — bust the cached count
    await this.countCache.invalidateUnreadCount(command.recipientId);

    return {
      notificationId: savedNotificationId,
      message: "Notification created successfully",
    };
  }
}

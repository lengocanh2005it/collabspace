// src/application/usecases/create-notification/create-notification.handler.ts
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
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
import { NotificationRealtimeService } from "../../services/notification-realtime.service";

export interface CreateNotificationResponse {
  notificationId: string;
  message: string;
}

@CommandHandler(CreateNotificationCommand)
export class CreateNotificationHandler
  implements ICommandHandler<CreateNotificationCommand, CreateNotificationResponse>
{
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
    @Inject(PROCESSED_EVENT_REPOSITORY_TOKEN)
    private readonly processedEventRepository: IProcessedEventRepository,
    private readonly countCache: NotificationCountCacheService,
    private readonly notificationRealtime: NotificationRealtimeService,
  ) {}

  async execute(command: CreateNotificationCommand): Promise<CreateNotificationResponse> {
    if (command.eventId) {
      const claimed = await this.processedEventRepository.tryClaim(command.eventId);

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

    try {
      const savedNotificationId = await this.notificationRepository.createAsync(notification);

      // New unread notification — bust the cached count
      await this.countCache.invalidateUnreadCount(command.recipientId);
      await this.notificationRealtime.emitNotificationCreated(
        command.recipientId,
        savedNotificationId,
      );

      return {
        notificationId: savedNotificationId,
        message: "Notification created successfully",
      };
    } catch (error) {
      // Release the idempotency claim so the next retry can reprocess this event.
      // Without this, a transient write failure would permanently block the event.
      if (command.eventId) {
        await this.processedEventRepository.releaseClaim(command.eventId);
      }
      throw error;
    }
  }
}

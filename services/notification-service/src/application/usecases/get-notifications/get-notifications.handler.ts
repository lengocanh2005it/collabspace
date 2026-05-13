// src/application/usecases/get-notifications/get-notifications.handler.ts
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { Inject, Injectable } from "@nestjs/common";
import { GetNotificationsQuery } from "./get-notifications.query";
import {
  INotificationRepository,
  NOTIFICATION_REPOSITORY_TOKEN,
} from "../../../domain/repositories/INotificationRepository";

export interface NotificationResponseDto {
  id: string;
  recipientId: string;
  actor: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  type: string;
  title: string;
  message: string;
  targetId: string;
  targetType: string;
  status: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetNotificationsResponse {
  notifications: NotificationResponseDto[];
  total: number;
  skip: number;
  limit: number;
  unreadCount: number;
}

@Injectable()
@QueryHandler(GetNotificationsQuery)
export class GetNotificationsHandler implements IQueryHandler<
  GetNotificationsQuery,
  GetNotificationsResponse
> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(
    query: GetNotificationsQuery,
  ): Promise<GetNotificationsResponse> {
    // Step 1: Get notifications with pagination
    const notifications =
      await this.notificationRepository.findByRecipientIdAsync(
        query.recipientId,
        {
          skip: query.skip,
          limit: query.limit,
        },
      );

    // Step 2: Get unread count
    const unreadCount =
      await this.notificationRepository.countUnreadByRecipientIdAsync(
        query.recipientId,
      );

    // Step 3: Map to response DTOs
    const responseNotifications = notifications.map((notification) => ({
      id: notification.getId(),
      recipientId: notification.getRecipientId(),
      actor: {
        id: notification.getActorId(),
        name: notification.getMetadata().actorName || "Unknown",
        avatarUrl: notification.getMetadata().actorAvatarUrl,
      },
      type: notification.getType(),
      title: notification.getTitle(),
      message: notification.getMessage(),
      targetId: notification.getTargetId(),
      targetType: notification.getTargetType(),
      status: notification.getStatus(),
      metadata: notification.getMetadata(),
      createdAt: notification.getCreatedAt(),
      updatedAt: notification.getUpdatedAt(),
    }));

    // Step 4: Return response
    return {
      notifications: responseNotifications,
      total: responseNotifications.length,
      skip: query.skip,
      limit: query.limit,
      unreadCount,
    };
  }
}

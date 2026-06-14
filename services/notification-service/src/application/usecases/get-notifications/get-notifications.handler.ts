// src/application/usecases/get-notifications/get-notifications.handler.ts
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { Inject, Injectable } from "@nestjs/common";
import { GetNotificationsQuery } from "./get-notifications.query";
import {
  type INotificationRepository,
  NOTIFICATION_REPOSITORY_TOKEN,
} from "../../../domain/repositories/INotificationRepository";
import {
  getMetadataString,
  type NotificationMetadata,
} from "../../../domain/types/notification-metadata";
import {
  USER_REPLICA_LOOKUP_TOKEN,
  UserReplicaLookupService,
} from "../../services/user-replica-lookup.service";
import { NotificationCountCacheService } from "../../../infrastructure/cache/notification-count-cache.service";

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
  metadata: NotificationMetadata;
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
    @Inject(USER_REPLICA_LOOKUP_TOKEN)
    private readonly userReplicaLookup: UserReplicaLookupService,
    private readonly countCache: NotificationCountCacheService,
  ) {}

  async execute(
    query: GetNotificationsQuery,
  ): Promise<GetNotificationsResponse> {
    const [notifications, total, unreadCount] = await Promise.all([
      this.notificationRepository.findByRecipientIdAsync(query.recipientId, {
        skip: query.skip,
        limit: query.limit,
      }),
      this.notificationRepository.countByRecipientIdAsync(query.recipientId),
      this.resolveUnreadCount(query.recipientId),
    ]);

    const actorIds = notifications.map((notification) =>
      notification.getActorId(),
    );
    const actorReplicas =
      await this.userReplicaLookup.findActiveMapByIdsAsync(actorIds);

    const mappedNotifications = notifications.map((notification) => {
      const metadata = notification.getMetadata();
      const actorId = notification.getActorId();
      const replica = actorReplicas.get(actorId);
      const fallbackName =
        getMetadataString(metadata, "actorName") || "Unknown";
      const fallbackAvatar = getMetadataString(metadata, "actorAvatarUrl");

      return {
        id: notification.getId(),
        recipientId: notification.getRecipientId(),
        actor: {
          id: actorId,
          name: replica?.displayName || replica?.fullName || fallbackName,
          avatarUrl: replica?.avatarUrl || fallbackAvatar,
        },
        type: notification.getType(),
        title: notification.getTitle(),
        message: notification.getMessage(),
        targetId: notification.getTargetId(),
        targetType: notification.getTargetType(),
        status: notification.getStatus(),
        metadata,
        createdAt: notification.getCreatedAt(),
        updatedAt: notification.getUpdatedAt(),
      };
    });

    return {
      notifications: mappedNotifications,
      total,
      skip: query.skip,
      limit: query.limit,
      unreadCount,
    };
  }

  private async resolveUnreadCount(recipientId: string): Promise<number> {
    const cached = await this.countCache.getUnreadCount(recipientId);
    if (cached !== null) return cached;

    const count = await this.notificationRepository.countUnreadByRecipientIdAsync(recipientId);
    await this.countCache.setUnreadCount(recipientId, count);
    return count;
  }
}

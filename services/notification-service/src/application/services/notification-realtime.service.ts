import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "../../infrastructure/cache/redis-client.token";
import { NotificationCountCacheService } from "../../infrastructure/cache/notification-count-cache.service";
import {
  NOTIFICATION_REPOSITORY_TOKEN,
  type INotificationRepository,
} from "../../domain/repositories/INotificationRepository";

export interface NotificationRealtimePayload {
  type: "notification.created";
  notificationId: string;
  unreadCount: number;
}

type StreamConnection = {
  close: () => void;
  sendEvent: (event: string, payload: NotificationRealtimePayload | { type: "connected" }) => void;
};

@Injectable()
export class NotificationRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationRealtimeService.name);
  private readonly connections = new Map<string, Map<string, StreamConnection>>();
  private readonly channelPattern = "notifications:user:*";
  private subscriber: Redis | null = null;

  constructor(
    @Optional()
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis | null = null,
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
    private readonly countCache: NotificationCountCacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.redis) return;

    try {
      this.subscriber = this.redis.duplicate();
      this.subscriber.on("pmessage", (_pattern, channel, message) => {
        void this.handlePubSubMessage(channel, message);
      });
      await this.subscriber.psubscribe(this.channelPattern);
    } catch (error) {
      this.logger.warn(
        `Realtime Redis subscribe disabled: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.subscriber = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const bucket of this.connections.values()) {
      for (const connection of bucket.values()) {
        connection.close();
      }
    }
    this.connections.clear();

    if (this.subscriber) {
      await this.subscriber.quit().catch(() => undefined);
      this.subscriber = null;
    }
  }

  addConnection(userId: string, connection: StreamConnection): () => void {
    const connectionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const bucket = this.connections.get(userId) ?? new Map<string, StreamConnection>();
    bucket.set(connectionId, connection);
    this.connections.set(userId, bucket);

    connection.sendEvent("connected", { type: "connected" });

    return () => {
      const currentBucket = this.connections.get(userId);
      if (!currentBucket) return;
      currentBucket.delete(connectionId);
      if (currentBucket.size === 0) {
        this.connections.delete(userId);
      }
    };
  }

  async emitNotificationCreated(recipientId: string, notificationId: string): Promise<void> {
    const unreadCount = await this.resolveUnreadCount(recipientId);
    const payload: NotificationRealtimePayload = {
      type: "notification.created",
      notificationId,
      unreadCount,
    };

    if (!this.redis) {
      this.emitLocal(recipientId, "notification.created", payload);
      return;
    }

    try {
      await this.redis.publish(this.channelForUser(recipientId), JSON.stringify(payload));
    } catch (error) {
      this.logger.warn(
        `Realtime publish failed for recipientId=${recipientId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.emitLocal(recipientId, "notification.created", payload);
    }
  }

  private async handlePubSubMessage(channel: string, message: string): Promise<void> {
    const recipientId = channel.split(":").at(-1);
    if (!recipientId) return;

    try {
      const payload = JSON.parse(message) as NotificationRealtimePayload;
      this.emitLocal(recipientId, "notification.created", payload);
    } catch (error) {
      this.logger.warn(
        `Realtime message parse failed for channel=${channel}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private emitLocal(
    recipientId: string,
    event: string,
    payload: NotificationRealtimePayload,
  ): void {
    const bucket = this.connections.get(recipientId);
    if (!bucket?.size) return;

    for (const [connectionId, connection] of bucket.entries()) {
      try {
        connection.sendEvent(event, payload);
      } catch (error) {
        this.logger.warn(
          `Realtime stream write failed for recipientId=${recipientId} connectionId=${connectionId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        try {
          connection.close();
        } finally {
          bucket.delete(connectionId);
        }
      }
    }

    if (bucket.size === 0) {
      this.connections.delete(recipientId);
    }
  }

  private channelForUser(userId: string): string {
    return `notifications:user:${userId}`;
  }

  private async resolveUnreadCount(recipientId: string): Promise<number> {
    const cached = await this.countCache.getUnreadCount(recipientId);
    if (cached !== null) return cached;

    const count = await this.notificationRepository.countUnreadByRecipientIdAsync(recipientId);
    await this.countCache.setUnreadCount(recipientId, count);
    return count;
  }
}

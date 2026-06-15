import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Redis } from "ioredis";
import { REDIS_CLIENT } from "./redis-client.token";

@Injectable()
export class NotificationCountCacheService {
  private readonly logger = new Logger(NotificationCountCacheService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis | null = null,
  ) {}

  async getUnreadCount(recipientId: string): Promise<number | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(this.unreadKey(recipientId));
      return raw !== null ? Number(raw) : null;
    } catch (err) {
      this.logger.warn(
        "Cache read error (unreadCount)",
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }

  async setUnreadCount(recipientId: string, count: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(
        this.unreadKey(recipientId),
        this.unreadTtl(),
        String(count),
      );
    } catch (err) {
      this.logger.warn(
        "Cache write error (unreadCount)",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  async invalidateUnreadCount(recipientId: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(this.unreadKey(recipientId));
    } catch (err) {
      this.logger.warn(
        "Cache invalidate error (unreadCount)",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private unreadKey(recipientId: string): string {
    return `unread-count:${recipientId}`;
  }

  private unreadTtl(): number {
    return Math.max(
      1,
      Number(
        this.configService.get<string>(
          "NOTIFICATION_UNREAD_CACHE_TTL_SECONDS",
        ) ?? 30,
      ),
    );
  }
}

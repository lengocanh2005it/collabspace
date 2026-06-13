import type { AuthLiteIdentity } from '@/domain/types/jwt';
import { ConfigurationService } from '@/configuration/configuration.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class AccessTokenVerifyLiteCacheService {
  private readonly logger = new Logger(AccessTokenVerifyLiteCacheService.name);

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly redisService: RedisService,
  ) {}

  async read(token: string): Promise<AuthLiteIdentity | null> {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      return await this.redisService.getJson<AuthLiteIdentity>(
        this.cacheKey(token),
      );
    } catch (error) {
      this.logger.debug(
        `Verify lite cache read skipped: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  async write(
    token: string,
    identity: AuthLiteIdentity,
    expiresAt?: number,
  ): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const ttlSeconds = this.resolveTtlSeconds(expiresAt);
    if (ttlSeconds <= 0) {
      return;
    }

    try {
      await this.redisService.setJson(this.cacheKey(token), identity, ttlSeconds);
    } catch (error) {
      this.logger.debug(
        `Verify lite cache write skipped: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private isEnabled(): boolean {
    return this.configurationService.getVerifyLiteCacheConfig().enabled;
  }

  private resolveTtlSeconds(expiresAt?: number): number {
    const { maxTtlSeconds } =
      this.configurationService.getVerifyLiteCacheConfig();

    if (!expiresAt) {
      return maxTtlSeconds;
    }

    const remaining = expiresAt - Math.floor(Date.now() / 1000);
    if (remaining <= 0) {
      return 0;
    }

    return Math.min(remaining, maxTtlSeconds);
  }

  private cacheKey(token: string): string {
    const digest = createHash('sha256').update(token).digest('hex');
    return `verify-lite:${digest}`;
  }
}

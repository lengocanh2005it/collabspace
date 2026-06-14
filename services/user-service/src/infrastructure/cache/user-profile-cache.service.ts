import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { UserProfile } from '../../domain/entities/user-profile.entity';
import type { UserPreferences } from '../../domain/entities/user-preferences.entity';
import type { UserStatus } from '../../domain/entities/user-status.entity';
import { REDIS_CLIENT } from './redis-client.token';

@Injectable()
export class UserProfileCacheService {
  private readonly logger = new Logger(UserProfileCacheService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null = null,
  ) {}

  // ── profile ──────────────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<UserProfile | null | undefined> {
    return this.get<UserProfile>(this.profileKey(userId));
  }

  async setProfile(userId: string, profile: UserProfile): Promise<void> {
    await this.set(this.profileKey(userId), profile, this.profileTtl());
  }

  async deleteProfile(userId: string): Promise<void> {
    await this.del(this.profileKey(userId));
  }

  async getManyProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
    const result = new Map<string, UserProfile>();
    if (!this.redis || userIds.length === 0) return result;

    try {
      const keys = userIds.map((id) => this.profileKey(id));
      const values = await this.redis.mget(...keys);
      for (let i = 0; i < userIds.length; i++) {
        const raw = values[i];
        if (raw !== null) {
          result.set(userIds[i], JSON.parse(raw) as UserProfile);
        }
      }
    } catch (err) {
      this.logger.warn('Cache mget error (profiles)', err instanceof Error ? err.message : String(err));
    }
    return result;
  }

  async setManyProfiles(profiles: UserProfile[]): Promise<void> {
    if (!this.redis || profiles.length === 0) return;
    try {
      const ttl = this.profileTtl();
      await Promise.all(
        profiles.map((p) => this.redis!.setex(this.profileKey(p.userId), ttl, JSON.stringify(p))),
      );
    } catch (err) {
      this.logger.warn('Cache set error (profiles)', err instanceof Error ? err.message : String(err));
    }
  }

  // ── preferences ──────────────────────────────────────────────────────────

  async getPreferences(userId: string): Promise<UserPreferences | null | undefined> {
    return this.get<UserPreferences>(this.prefsKey(userId));
  }

  async setPreferences(userId: string, prefs: UserPreferences): Promise<void> {
    await this.set(this.prefsKey(userId), prefs, this.prefsTtl());
  }

  async deletePreferences(userId: string): Promise<void> {
    await this.del(this.prefsKey(userId));
  }

  // ── status ────────────────────────────────────────────────────────────────

  async getStatus(userId: string): Promise<UserStatus | null | undefined> {
    return this.get<UserStatus>(this.statusKey(userId));
  }

  async setStatus(userId: string, status: UserStatus): Promise<void> {
    await this.set(this.statusKey(userId), status, this.statusTtl());
  }

  async deleteStatus(userId: string): Promise<void> {
    await this.del(this.statusKey(userId));
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async get<T>(key: string): Promise<T | null | undefined> {
    if (!this.redis) return undefined;
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return undefined;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Cache read error (${key})`, err instanceof Error ? err.message : String(err));
      return undefined;
    }
  }

  private async set(key: string, value: unknown, ttl: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (err) {
      this.logger.warn(`Cache write error (${key})`, err instanceof Error ? err.message : String(err));
    }
  }

  private async del(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`Cache delete error (${key})`, err instanceof Error ? err.message : String(err));
    }
  }

  private profileKey(userId: string): string {
    return `profile:${userId}`;
  }

  private prefsKey(userId: string): string {
    return `prefs:${userId}`;
  }

  private statusKey(userId: string): string {
    return `status:${userId}`;
  }

  private profileTtl(): number {
    return Math.max(1, Number(this.configService.get<string>('USER_PROFILE_CACHE_TTL_SECONDS') ?? 300));
  }

  private prefsTtl(): number {
    return Math.max(1, Number(this.configService.get<string>('USER_PREFS_CACHE_TTL_SECONDS') ?? 600));
  }

  private statusTtl(): number {
    return Math.max(1, Number(this.configService.get<string>('USER_STATUS_CACHE_TTL_SECONDS') ?? 60));
  }
}

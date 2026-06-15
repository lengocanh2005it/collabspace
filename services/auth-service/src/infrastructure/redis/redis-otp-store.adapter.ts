import { OtpStore } from '@/domain/ports/otp-store.port';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisOtpStoreAdapter implements OtpStore {
  constructor(private readonly redisService: RedisService) {}

  assertAvailable(): Promise<void> {
    return this.redisService.assertAvailable();
  }

  delete(key: string | string[]): Promise<number> {
    return this.redisService.delete(key);
  }

  exists(key: string): Promise<boolean> {
    return this.redisService.exists(key);
  }

  expire(key: string, ttlSeconds: number): Promise<boolean> {
    return this.redisService.expire(key, ttlSeconds);
  }

  getJson<T>(key: string): Promise<T | null> {
    return this.redisService.getJson<T>(key);
  }

  increment(key: string): Promise<number> {
    return this.redisService.increment(key);
  }

  ping(): Promise<boolean> {
    return this.redisService.ping();
  }

  set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    return this.redisService.set(key, value, ttlSeconds);
  }

  setJson(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<'OK' | null> {
    return this.redisService.setJson(key, value, ttlSeconds);
  }

  ttl(key: string): Promise<number> {
    return this.redisService.ttl(key);
  }
}

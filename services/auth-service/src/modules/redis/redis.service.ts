import { REDIS_CLIENT } from '@/common/constants/redis.constant';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  async delete(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];
    return this.redisClient.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redisClient.exists(key)) > 0;
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return (await this.redisClient.expire(key, ttlSeconds)) === 1;
  }

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  async increment(key: string): Promise<number> {
    return this.redisClient.incr(key);
  }

  async ping(): Promise<boolean> {
    return (await this.redisClient.ping()) === 'PONG';
  }

  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<'OK' | null> {
    if (ttlSeconds === undefined) {
      return this.redisClient.set(key, value);
    }

    return this.redisClient.set(key, value, 'EX', ttlSeconds);
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<'OK' | null> {
    return this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    return this.redisClient.ttl(key);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient.status === 'end') {
      return;
    }

    if (this.redisClient.status === 'wait') {
      this.redisClient.disconnect();
      return;
    }

    await this.redisClient.quit();
  }
}

import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis, { type SentinelAddress } from 'ioredis';
import { REDIS_CLIENT } from './redis-client.token';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis | null => {
        const mode = configService.get<string>('REDIS_MODE') ?? 'standalone';
        const url = configService.get<string>('REDIS_URL');
        const host = configService.get<string>('REDIS_HOST');

        if (mode !== 'sentinel' && !url && !host) {
          return null;
        }

        const logger = new Logger('RedisClient[user]');
        const password = configService.get<string>('REDIS_PASSWORD') || undefined;
        const db = Number(configService.get<string>('REDIS_DB') ?? 0);

        let client: Redis;

        if (mode === 'sentinel') {
          const sentinels = parseSentinelAddresses(configService.get<string>('REDIS_SENTINELS'));
          if (sentinels.length === 0) {
            logger.warn('REDIS_MODE=sentinel but REDIS_SENTINELS is empty; Redis disabled');
            return null;
          }
          client = new Redis({
            sentinels,
            name: configService.get<string>('REDIS_SENTINEL_NAME') ?? 'mymaster',
            db,
            password,
            sentinelPassword: configService.get<string>('REDIS_SENTINEL_PASSWORD') || password,
            keyPrefix: 'user:',
            lazyConnect: false,
            maxRetriesPerRequest: 1,
            enableReadyCheck: true,
            connectTimeout: Number(
              configService.get<string>('REDIS_SENTINEL_CONNECT_TIMEOUT_MS') ?? 10000,
            ),
            commandTimeout: Number(
              configService.get<string>('REDIS_SENTINEL_COMMAND_TIMEOUT_MS') ?? 5000,
            ),
          });
        } else if (url) {
          client = new Redis(url, {
            keyPrefix: 'user:',
            lazyConnect: false,
            maxRetriesPerRequest: 1,
          });
        } else {
          client = new Redis({
            host,
            port: Number(configService.get<string>('REDIS_PORT') ?? 6379),
            db,
            password,
            keyPrefix: 'user:',
            lazyConnect: false,
            maxRetriesPerRequest: 1,
          });
        }

        client.on('connect', () => logger.log('Redis connection established'));
        client.on('error', (err: Error) => logger.warn(`Redis error: ${err.message}`));
        client.on('ready', () => logger.log('Redis client ready'));

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}

function parseSentinelAddresses(value: string | undefined): SentinelAddress[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [host, rawPort] = item.split(':');
      return { host, port: Number(rawPort || 26379) };
    })
    .filter((item) => item.host && Number.isFinite(item.port));
}

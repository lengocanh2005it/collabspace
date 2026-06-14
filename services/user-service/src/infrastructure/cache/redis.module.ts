import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis-client.token';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis | null => {
        const url = configService.get<string>('REDIS_URL');
        const host = configService.get<string>('REDIS_HOST');

        if (!url && !host) {
          return null;
        }

        const logger = new Logger('RedisClient[user]');
        const password = configService.get<string>('REDIS_PASSWORD') || undefined;
        const port = Number(configService.get<string>('REDIS_PORT') ?? 6379);
        const db = Number(configService.get<string>('REDIS_DB') ?? 0);

        const client = url
          ? new Redis(url, { keyPrefix: 'user:', lazyConnect: false, maxRetriesPerRequest: 1 })
          : new Redis({
              host,
              port,
              db,
              password,
              keyPrefix: 'user:',
              lazyConnect: false,
              maxRetriesPerRequest: 1,
            });

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

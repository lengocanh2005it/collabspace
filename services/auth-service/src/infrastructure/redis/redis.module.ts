import { ConfigurationService } from '@/configuration/configuration.service';
import { Logger, Module } from '@nestjs/common';
import { REDIS_CLIENT } from '@/common/constants/redis.constant';
import Redis, { type RedisOptions } from 'ioredis';
import { RedisService } from './redis.service';

@Module({
  providers: [
    {
      inject: [ConfigurationService],
      provide: REDIS_CLIENT,
      useFactory: (configurationService: ConfigurationService) => {
        const logger = new Logger('RedisClient');
        const redisConfig = configurationService.getRedisConfig();
        const options: RedisOptions = configurationService.getRedisOptions();

        const redis =
          redisConfig.mode !== 'sentinel' && redisConfig.url
            ? new Redis(redisConfig.url, options)
            : new Redis(options);

        redis.on('connect', () => {
          logger.log('Redis connection established');
        });

        redis.on('error', (error) => {
          logger.error(`Redis error: ${error.message}`);
        });

        redis.on('ready', () => {
          logger.log('Redis client ready');
        });

        return redis;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}

import { ServiceUnavailableException } from '@nestjs/common';

export const REDIS_UNAVAILABLE_CODE = 'REDIS_UNAVAILABLE';

export function throwRedisUnavailable(_cause?: unknown): never {
  throw new ServiceUnavailableException({
    code: REDIS_UNAVAILABLE_CODE,
    message: 'Redis is unavailable',
  });
}

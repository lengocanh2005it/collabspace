import { ConfigurationService } from '@/configuration/configuration.service';
import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

jest.mock('ioredis', () => {
  const MockRedis = jest.fn().mockImplementation(function (this: { on: jest.Mock }) {
    this.on = jest.fn();
  });
  return { default: MockRedis, __esModule: true };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockRedis: jest.Mock = (jest.requireMock('ioredis') as any).default;

function makeConfigurationService(env: Record<string, string | number | undefined>) {
  const configService = {
    get: <T>(key: string) => env[key] as T | undefined,
  } as unknown as ConfigService;
  return new ConfigurationService(configService);
}

function simulateFactory(svc: ConfigurationService) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Redis = require('ioredis').default;
  const redisConfig = svc.getRedisConfig();
  const options: RedisOptions = svc.getRedisOptions();
  const client =
    redisConfig.mode !== 'sentinel' && redisConfig.url
      ? new Redis(redisConfig.url, options)
      : new Redis(options);
  client.on('connect', jest.fn());
  client.on('error', jest.fn());
  client.on('ready', jest.fn());
  return client;
}

describe('auth-service RedisModule factory', () => {
  afterEach(() => MockRedis.mockClear());

  it('creates standalone client with host/port using auth: prefix', () => {
    const svc = makeConfigurationService({ 'redis.host': 'localhost', 'redis.port': 6379 });
    simulateFactory(svc);
    expect(MockRedis).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'localhost', port: 6379, keyPrefix: 'auth:' }),
    );
  });

  it('creates standalone client with url when redis.url is set', () => {
    const svc = makeConfigurationService({ 'redis.url': 'redis://localhost:6379' });
    simulateFactory(svc);
    expect(MockRedis).toHaveBeenCalledWith('redis://localhost:6379', expect.anything());
  });

  it('creates sentinel client when redis.mode=sentinel', () => {
    const svc = makeConfigurationService({
      'redis.mode': 'sentinel',
      'redis.sentinels': 'redis:26379',
      'redis.sentinelName': 'mymaster',
      'redis.password': 'secret',
    });
    simulateFactory(svc);
    expect(MockRedis).toHaveBeenCalledWith(
      expect.objectContaining({
        sentinels: [{ host: 'redis', port: 26379 }],
        name: 'mymaster',
        keyPrefix: 'auth:',
        enableReadyCheck: true,
      }),
    );
  });

  it('sentinel mode ignores redis.url', () => {
    const svc = makeConfigurationService({
      'redis.mode': 'sentinel',
      'redis.sentinels': 'redis:26379',
      'redis.url': 'redis://other:6379',
      'redis.sentinelName': 'mymaster',
    });
    simulateFactory(svc);
    expect(MockRedis).not.toHaveBeenCalledWith('redis://other:6379', expect.anything());
    expect(MockRedis).toHaveBeenCalledWith(
      expect.objectContaining({ sentinels: [{ host: 'redis', port: 26379 }] }),
    );
  });
});

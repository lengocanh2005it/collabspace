import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { REDIS_CLIENT } from './redis-client.token';
import { RedisModule } from './redis.module';

jest.mock('ioredis', () => {
  const MockRedis = jest.fn().mockImplementation(function (this: { on: jest.Mock }) {
    this.on = jest.fn();
  });
  return { default: MockRedis, __esModule: true };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockRedis: jest.Mock = (jest.requireMock('ioredis') as any).default;

function makeConfigService(env: Record<string, string>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

async function createClient(env: Record<string, string>) {
  const module = await Test.createTestingModule({ imports: [RedisModule] })
    .overrideProvider(ConfigService)
    .useValue(makeConfigService(env))
    .compile();
  return module.get<unknown>(REDIS_CLIENT);
}

describe('user-service RedisModule', () => {
  afterEach(() => MockRedis.mockClear());

  it('returns null when no host, url, or sentinel config', async () => {
    const client = await createClient({});
    expect(client).toBeNull();
  });

  it('creates standalone client with host/port', async () => {
    const client = await createClient({ REDIS_HOST: 'localhost', REDIS_PORT: '6379' });
    expect(client).not.toBeNull();
    expect(MockRedis).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'localhost', port: 6379, keyPrefix: 'user:' }),
    );
  });

  it('creates standalone client with REDIS_URL', async () => {
    const client = await createClient({ REDIS_URL: 'redis://localhost:6379' });
    expect(client).not.toBeNull();
    expect(MockRedis).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({ keyPrefix: 'user:' }),
    );
  });

  it('creates sentinel client when REDIS_MODE=sentinel', async () => {
    const client = await createClient({
      REDIS_MODE: 'sentinel',
      REDIS_SENTINELS: 'redis:26379',
      REDIS_SENTINEL_NAME: 'mymaster',
      REDIS_PASSWORD: 'secret',
    });
    expect(client).not.toBeNull();
    expect(MockRedis).toHaveBeenCalledWith(
      expect.objectContaining({
        sentinels: [{ host: 'redis', port: 26379 }],
        name: 'mymaster',
        keyPrefix: 'user:',
        enableReadyCheck: true,
      }),
    );
  });

  it('returns null when REDIS_MODE=sentinel but REDIS_SENTINELS is empty', async () => {
    const client = await createClient({ REDIS_MODE: 'sentinel', REDIS_SENTINELS: '' });
    expect(client).toBeNull();
  });

  it('parses multiple sentinel addresses', async () => {
    await createClient({
      REDIS_MODE: 'sentinel',
      REDIS_SENTINELS: 'node1:26379,node2:26379',
      REDIS_SENTINEL_NAME: 'mymaster',
    });
    expect(MockRedis).toHaveBeenCalledWith(
      expect.objectContaining({
        sentinels: [
          { host: 'node1', port: 26379 },
          { host: 'node2', port: 26379 },
        ],
      }),
    );
  });

  it('uses default sentinel port 26379 when port omitted', async () => {
    await createClient({
      REDIS_MODE: 'sentinel',
      REDIS_SENTINELS: 'redis',
      REDIS_SENTINEL_NAME: 'mymaster',
    });
    expect(MockRedis).toHaveBeenCalledWith(
      expect.objectContaining({ sentinels: [{ host: 'redis', port: 26379 }] }),
    );
  });

  it('sentinel mode ignores REDIS_URL', async () => {
    await createClient({
      REDIS_MODE: 'sentinel',
      REDIS_SENTINELS: 'redis:26379',
      REDIS_URL: 'redis://other:6379',
      REDIS_SENTINEL_NAME: 'mymaster',
    });
    expect(MockRedis).toHaveBeenCalledWith(
      expect.objectContaining({ sentinels: [{ host: 'redis', port: 26379 }] }),
    );
    expect(MockRedis).not.toHaveBeenCalledWith('redis://other:6379', expect.anything());
  });
});

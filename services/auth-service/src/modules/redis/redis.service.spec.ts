import { RedisService } from './redis.service';

describe('RedisService', () => {
  const redisClientMock = {
    del: jest.fn(),
    disconnect: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    get: jest.fn(),
    incr: jest.fn(),
    quit: jest.fn(),
    set: jest.fn(),
    status: 'ready',
    ttl: jest.fn(),
  };

  let redisService: RedisService;

  beforeEach(() => {
    jest.clearAllMocks();
    redisClientMock.status = 'ready';
    redisService = new RedisService(redisClientMock as never);
  });

  it('gets plain string values', async () => {
    redisClientMock.get.mockResolvedValue('cached-value');

    await expect(redisService.get('cache:key')).resolves.toBe('cached-value');
    expect(redisClientMock.get).toHaveBeenCalledWith('cache:key');
  });

  it('sets values with ttl', async () => {
    redisClientMock.set.mockResolvedValue('OK');

    await expect(redisService.set('cache:key', 'value', 60)).resolves.toBe(
      'OK',
    );
    expect(redisClientMock.set).toHaveBeenCalledWith(
      'cache:key',
      'value',
      'EX',
      60,
    );
  });

  it('serializes json values', async () => {
    redisClientMock.set.mockResolvedValue('OK');

    await expect(
      redisService.setJson('cache:key', { userId: 'user-1' }, 30),
    ).resolves.toBe('OK');
    expect(redisClientMock.set).toHaveBeenCalledWith(
      'cache:key',
      '{"userId":"user-1"}',
      'EX',
      30,
    );
  });

  it('parses json values', async () => {
    redisClientMock.get.mockResolvedValue('{"userId":"user-1"}');

    await expect(
      redisService.getJson<{ userId: string }>('cache:key'),
    ).resolves.toEqual({
      userId: 'user-1',
    });
  });

  it('deletes multiple keys', async () => {
    redisClientMock.del.mockResolvedValue(2);

    await expect(redisService.delete(['a', 'b'])).resolves.toBe(2);
    expect(redisClientMock.del).toHaveBeenCalledWith('a', 'b');
  });

  it('disconnects lazy clients without opening a connection', async () => {
    redisClientMock.status = 'wait';

    await redisService.onModuleDestroy();

    expect(redisClientMock.disconnect).toHaveBeenCalled();
    expect(redisClientMock.quit).not.toHaveBeenCalled();
  });
});

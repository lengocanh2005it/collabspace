import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { REDIS_CLIENT } from "./redis-client.token";
import { RedisModule } from "./redis.module";

jest.mock("ioredis", () => {
  const MockRedis = jest.fn().mockImplementation(function (this: { on: jest.Mock }) {
    this.on = jest.fn();
  });
  return { default: MockRedis, __esModule: true };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockRedis: jest.Mock = (jest.requireMock("ioredis") as any).default;

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

describe("task-service RedisModule", () => {
  afterEach(() => MockRedis.mockClear());

  it("returns null when no host, url, or sentinel config", async () => {
    expect(await createClient({})).toBeNull();
  });

  it("creates standalone client with task: prefix", async () => {
    await createClient({ REDIS_HOST: "localhost", REDIS_PORT: "6379" });
    expect(MockRedis).toHaveBeenCalledWith(
      expect.objectContaining({ host: "localhost", port: 6379, keyPrefix: "task:" }),
    );
  });

  it("creates standalone client with REDIS_URL", async () => {
    await createClient({ REDIS_URL: "redis://localhost:6379" });
    expect(MockRedis).toHaveBeenCalledWith(
      "redis://localhost:6379",
      expect.objectContaining({ keyPrefix: "task:" }),
    );
  });

  it("creates sentinel client when REDIS_MODE=sentinel", async () => {
    const client = await createClient({
      REDIS_MODE: "sentinel",
      REDIS_SENTINELS: "redis:26379",
      REDIS_SENTINEL_NAME: "mymaster",
    });
    expect(client).not.toBeNull();
    expect(MockRedis).toHaveBeenCalledWith(
      expect.objectContaining({
        sentinels: [{ host: "redis", port: 26379 }],
        name: "mymaster",
        keyPrefix: "task:",
        enableReadyCheck: true,
      }),
    );
  });

  it("returns null when REDIS_MODE=sentinel but REDIS_SENTINELS is empty", async () => {
    expect(await createClient({ REDIS_MODE: "sentinel", REDIS_SENTINELS: "" })).toBeNull();
  });

  it("sentinel mode ignores REDIS_URL", async () => {
    await createClient({
      REDIS_MODE: "sentinel",
      REDIS_SENTINELS: "redis:26379",
      REDIS_URL: "redis://other:6379",
      REDIS_SENTINEL_NAME: "mymaster",
    });
    expect(MockRedis).toHaveBeenCalledWith(
      expect.objectContaining({ sentinels: [{ host: "redis", port: 26379 }] }),
    );
    expect(MockRedis).not.toHaveBeenCalledWith("redis://other:6379", expect.anything());
  });
});

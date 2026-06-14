import { WorkspaceMembershipCacheService } from "./workspace-membership-cache.service";
import type { Redis } from "ioredis";

describe("WorkspaceMembershipCacheService", () => {
  const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
  const userId = "660e8400-e29b-41d4-a716-446655440001";

  function createMockRedis(): Redis {
    const store = new Map<string, { value: string; expiresAt: number }>();
    return {
      get: jest.fn((key: string) => {
        const entry = store.get(key);
        if (!entry || entry.expiresAt <= Date.now()) {
          store.delete(key);
          return Promise.resolve(null);
        }
        return Promise.resolve(entry.value);
      }),
      setex: jest.fn((key: string, ttl: number, value: string) => {
        store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
        return Promise.resolve("OK");
      }),
      del: jest.fn((key: string) => {
        store.delete(key);
        return Promise.resolve(1);
      }),
    } as unknown as Redis;
  }

  function createService(
    config: Record<string, string | undefined> = {},
    redis: Redis | null = createMockRedis(),
  ): WorkspaceMembershipCacheService {
    const configService = {
      get: jest.fn((key: string) => config[key]),
    };
    return new WorkspaceMembershipCacheService(configService as never, redis);
  }

  it("returns undefined on cache miss", async () => {
    const service = createService();
    expect(await service.read(workspaceId, userId)).toBeUndefined();
  });

  it("returns cached membership snapshot", async () => {
    const service = createService({ WORKSPACE_MEMBERSHIP_CACHE_TTL_SECONDS: "30" });
    const snapshot = { isMember: true, role: "member" as const };

    await service.write(workspaceId, userId, snapshot);
    expect(await service.read(workspaceId, userId)).toEqual(snapshot);
  });

  it("returns null for a cached negative result", async () => {
    const service = createService();
    await service.write(workspaceId, userId, null);
    expect(await service.read(workspaceId, userId)).toBeNull();
  });

  it("returns undefined after TTL expires", async () => {
    jest.useFakeTimers();
    const service = createService({ WORKSPACE_MEMBERSHIP_CACHE_TTL_SECONDS: "30" });
    const snapshot = { isMember: true, role: "member" as const };

    await service.write(workspaceId, userId, snapshot);
    jest.advanceTimersByTime(31_000);
    expect(await service.read(workspaceId, userId)).toBeUndefined();
    jest.useRealTimers();
  });

  it("can be disabled via env flag", async () => {
    const service = createService({ WORKSPACE_MEMBERSHIP_CACHE_ENABLED: "false" });
    await service.write(workspaceId, userId, { isMember: true, role: "member" });
    expect(await service.read(workspaceId, userId)).toBeUndefined();
  });

  it("is disabled when no Redis client is provided", async () => {
    const service = createService({}, null);
    await service.write(workspaceId, userId, { isMember: true, role: "member" });
    expect(await service.read(workspaceId, userId)).toBeUndefined();
  });

  it("returns undefined and does not throw on Redis error (fail-open)", async () => {
    const faultyRedis = {
      get: jest.fn().mockRejectedValue(new Error("connection refused")),
      setex: jest.fn().mockRejectedValue(new Error("connection refused")),
      del: jest.fn().mockRejectedValue(new Error("connection refused")),
    } as unknown as Redis;
    const service = createService({}, faultyRedis);

    await expect(
      service.write(workspaceId, userId, { isMember: true, role: "member" }),
    ).resolves.toBeUndefined();
    expect(await service.read(workspaceId, userId)).toBeUndefined();
  });
});

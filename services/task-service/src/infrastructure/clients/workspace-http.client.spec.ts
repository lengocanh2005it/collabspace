import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Redis } from "ioredis";
import { requestIdStorage } from "../../common/http/request-id.context";
import { WorkspaceHttpClient } from "./workspace-http.client";
import { WorkspaceMembershipCacheService } from "../cache/workspace-membership-cache.service";

function createMockRedis(): Redis {
  const store = new Map<string, string>();
  return {
    get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setex: jest.fn((key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return Promise.resolve("OK");
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
  } as unknown as Redis;
}

describe("WorkspaceHttpClient", () => {
  const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
  const userId = "660e8400-e29b-41d4-a716-446655440001";
  const originalFetch = global.fetch;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  function createClient(options?: {
    serviceJwtSecret?: string;
  }): WorkspaceHttpClient {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "WORKSPACE_SERVICE_URL") {
          return "http://workspace-service:8080";
        }
        if (key === "WORKSPACE_SERVICE_TIMEOUT_MS") {
          return "3000";
        }
        if (key === "SERVICE_JWT_SECRET") {
          return options?.serviceJwtSecret;
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    const membershipCache = new WorkspaceMembershipCacheService(
      configService,
      createMockRedis(),
    );

    return new WorkspaceHttpClient(configService, membershipCache);
  }

  it("should call internal membership endpoint once via getMembershipAsync", async () => {
    process.env.NODE_ENV = "production";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        workspaceId,
        userId,
        isMember: true,
        role: "member",
      }),
    });

    const client = createClient({
      serviceJwtSecret: "phase-3-service-jwt-secret",
    });
    const membership = await client.getMembershipAsync(workspaceId, userId);

    expect(membership).toEqual({ isMember: true, role: "member" });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should serve repeated membership checks from cache", async () => {
    process.env.NODE_ENV = "production";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        workspaceId,
        userId,
        isMember: true,
        role: "member",
      }),
    });

    const client = createClient({
      serviceJwtSecret: "phase-3-service-jwt-secret",
    });

    await client.getMembershipAsync(workspaceId, userId);
    await client.getMembershipAsync(workspaceId, userId);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should call internal membership endpoint with service JWT", async () => {
    process.env.NODE_ENV = "production";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        workspaceId,
        userId,
        isMember: true,
        role: "member",
      }),
    });

    const client = createClient({
      serviceJwtSecret: "phase-3-service-jwt-secret",
    });
    await client.validateWorkspaceAsync(workspaceId, userId);

    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];

    expect(requestInit.headers.Authorization).toMatch(/^Bearer /);
  });

  it("forwards X-Request-Id from async context", async () => {
    process.env.NODE_ENV = "production";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        workspaceId,
        userId,
        isMember: true,
        role: "member",
      }),
    });

    const client = createClient({
      serviceJwtSecret: "phase-3-service-jwt-secret",
    });

    await requestIdStorage.run({ requestId: "trace-abc" }, () =>
      client.validateWorkspaceAsync(workspaceId, userId),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Request-Id": "trace-abc",
        }),
      }),
    );
  });

  it("should return false when workspace is not found", async () => {
    process.env.NODE_ENV = "development";
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const client = createClient();
    await expect(
      client.validateWorkspaceAsync(workspaceId, userId),
    ).resolves.toBe(false);
  });

  it("should reject when service JWT secret is missing in production", async () => {
    process.env.NODE_ENV = "production";
    const client = createClient();

    await expect(
      client.validateWorkspaceAsync(workspaceId, userId),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});

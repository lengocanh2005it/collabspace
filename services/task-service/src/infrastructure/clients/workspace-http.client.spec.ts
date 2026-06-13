import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { requestIdStorage } from "../../common/http/request-id.context";
import { WorkspaceHttpClient } from "./workspace-http.client";
import { WorkspaceMembershipCacheService } from "../cache/workspace-membership-cache.service";

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

  function createClient(token?: string): WorkspaceHttpClient {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "WORKSPACE_SERVICE_URL") {
          return "http://workspace-service:8080";
        }
        if (key === "WORKSPACE_SERVICE_TIMEOUT_MS") {
          return "3000";
        }
        if (key === "INTERNAL_SERVICE_TOKEN") {
          return token;
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    const membershipCache = new WorkspaceMembershipCacheService(configService);

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

    const client = createClient("shared-secret");
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

    const client = createClient("shared-secret");

    await client.getMembershipAsync(workspaceId, userId);
    await client.getMembershipAsync(workspaceId, userId);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should call internal membership endpoint with service token", async () => {
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

    const client = createClient("shared-secret");
    const isMember = await client.validateWorkspaceAsync(workspaceId, userId);

    expect(isMember).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      `http://workspace-service:8080/api/v1/workspaces/internal/${workspaceId}/membership?userId=${userId}`,
      expect.objectContaining({
        headers: {
          "X-Internal-Service-Token": "shared-secret",
        },
      }),
    );
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

    const client = createClient("shared-secret");

    await requestIdStorage.run({ requestId: "trace-abc" }, () =>
      client.validateWorkspaceAsync(workspaceId, userId),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Request-Id": "trace-abc",
          "X-Internal-Service-Token": "shared-secret",
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

  it("should reject when internal token is missing in production", async () => {
    process.env.NODE_ENV = "production";
    const client = createClient();

    await expect(
      client.validateWorkspaceAsync(workspaceId, userId),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});

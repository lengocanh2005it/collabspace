import { WorkspaceMembershipCacheService } from "./workspace-membership-cache.service";

describe("WorkspaceMembershipCacheService", () => {
  const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
  const userId = "660e8400-e29b-41d4-a716-446655440001";

  function createService(
    config: Record<string, string | undefined> = {},
  ): WorkspaceMembershipCacheService {
    const configService = {
      get: jest.fn((key: string) => config[key]),
    };

    return new WorkspaceMembershipCacheService(configService as never);
  }

  it("returns undefined on cache miss", () => {
    const service = createService();

    expect(service.read(workspaceId, userId)).toBeUndefined();
  });

  it("returns cached membership snapshots until ttl expires", () => {
    jest.useFakeTimers();
    const service = createService({
      WORKSPACE_MEMBERSHIP_CACHE_TTL_SECONDS: "30",
    });
    const snapshot = { isMember: true, role: "member" as const };

    service.write(workspaceId, userId, snapshot);

    expect(service.read(workspaceId, userId)).toEqual(snapshot);

    jest.advanceTimersByTime(31_000);

    expect(service.read(workspaceId, userId)).toBeUndefined();
    jest.useRealTimers();
  });

  it("can be disabled via env flag", () => {
    const service = createService({
      WORKSPACE_MEMBERSHIP_CACHE_ENABLED: "false",
    });

    service.write(workspaceId, userId, { isMember: true, role: "member" });

    expect(service.read(workspaceId, userId)).toBeUndefined();
  });
});

import { UserReplicaLookupService } from "./user-replica-lookup.service";
import type { IUserReplicaRepository } from "../ports/IUserReplicaRepository";
import type { UserProfileHttpClient } from "../../infrastructure/clients/user-profile-http.client";
import type { MetricsService } from "../../metrics/metrics.service";

describe("UserReplicaLookupService", () => {
  const userReplicaRepo = {
    findManyByIdsAsync: jest.fn(),
    findActiveByEmailAsync: jest.fn(),
  } as unknown as jest.Mocked<IUserReplicaRepository>;
  const userProfileHttpClient = {
    isFallbackEnabled: jest.fn(),
    lookupReplicas: jest.fn(),
  } as unknown as jest.Mocked<UserProfileHttpClient>;
  const metricsService = {
    recordReplicaFallback: jest.fn(),
  } as unknown as jest.Mocked<MetricsService>;

  let service: UserReplicaLookupService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserReplicaLookupService(userReplicaRepo, userProfileHttpClient, metricsService);
  });

  describe("findActiveUserIdByEmailAsync", () => {
    it("returns user id when an active replica matches email", async () => {
      userReplicaRepo.findActiveByEmailAsync.mockResolvedValue({
        userId: "user-123",
        email: "member@example.com",
        fullName: "Member",
        isActive: true,
      });

      await expect(service.findActiveUserIdByEmailAsync("member@example.com")).resolves.toBe(
        "user-123",
      );
      expect(userReplicaRepo.findActiveByEmailAsync).toHaveBeenCalledWith("member@example.com");
    });

    it("returns null when no active replica matches email", async () => {
      userReplicaRepo.findActiveByEmailAsync.mockResolvedValue(null);

      await expect(service.findActiveUserIdByEmailAsync("unknown@example.com")).resolves.toBeNull();
    });
  });
});

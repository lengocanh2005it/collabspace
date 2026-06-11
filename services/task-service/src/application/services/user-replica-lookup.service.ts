import { Inject, Injectable } from "@nestjs/common";
import { UserProfileHttpClient } from "../../infrastructure/clients/user-profile-http.client";
import {
  type IUserReplicaRepository,
  USER_REPLICA_REPOSITORY_TOKEN,
} from "../ports/IUserReplicaRepository";
import { UserReplica } from "../../infrastructure/persistence/user-replica.schema";
import { MetricsService } from "../../metrics/metrics.service";

export const USER_REPLICA_LOOKUP_TOKEN = Symbol("USER_REPLICA_LOOKUP");

@Injectable()
export class UserReplicaLookupService {
  constructor(
    @Inject(USER_REPLICA_REPOSITORY_TOKEN)
    private readonly userReplicaRepo: IUserReplicaRepository,
    private readonly userProfileHttpClient: UserProfileHttpClient,
    private readonly metricsService: MetricsService,
  ) {}

  async findActiveByIdAsync(userId: string): Promise<UserReplica | null> {
    const existing = await this.userReplicaRepo.findByIdAsync(userId);

    if (existing?.isActive) {
      return existing;
    }

    return this.hydrateAndGetActive({ userIds: [userId] }, "findById");
  }

  async findActiveByUsernameAsync(
    username: string,
  ): Promise<UserReplica | null> {
    const normalized = username.trim().toLowerCase();
    const existing = await this.userReplicaRepo.findByUsernameAsync(normalized);

    if (existing?.isActive) {
      return existing;
    }

    return this.hydrateAndGetActive({ username: normalized }, "findByUsername");
  }

  private async hydrateAndGetActive(
    request: { userIds?: string[]; username?: string },
    operation: "findById" | "findByUsername",
  ): Promise<UserReplica | null> {
    if (!this.userProfileHttpClient.isFallbackEnabled()) {
      return null;
    }

    const remoteReplicas =
      await this.userProfileHttpClient.lookupReplicas(request);

    if (remoteReplicas.length === 0) {
      return null;
    }

    this.metricsService.recordReplicaFallback(operation);

    for (const remote of remoteReplicas) {
      await this.userReplicaRepo.upsertAsync({
        userId: remote.userId,
        email: remote.email,
        username: remote.username?.toLowerCase() ?? null,
        fullName: remote.fullName,
        displayName: remote.displayName ?? remote.fullName,
        avatarUrl: remote.avatarUrl ?? null,
        isActive: remote.isActive,
      });
    }

    if (request.username) {
      return this.userReplicaRepo.findByUsernameAsync(request.username);
    }

    const userId = request.userIds?.[0];

    if (!userId) {
      return null;
    }

    const record = await this.userReplicaRepo.findByIdAsync(userId);
    return record?.isActive ? record : null;
  }

  async findActiveMapByIdsAsync(
    userIds: string[],
  ): Promise<Map<string, UserReplica>> {
    const uniqueIds = [
      ...new Set(userIds.map((id) => id.trim()).filter(Boolean)),
    ];
    const result = new Map<string, UserReplica>();

    if (uniqueIds.length === 0) {
      return result;
    }

    const existing = await this.userReplicaRepo.findManyByIdsAsync(uniqueIds);

    for (const record of existing) {
      if (record.isActive) {
        result.set(record.userId, record);
      }
    }

    const missing = uniqueIds.filter((userId) => !result.has(userId));

    if (
      missing.length === 0 ||
      !this.userProfileHttpClient.isFallbackEnabled()
    ) {
      return result;
    }

    const remoteReplicas = await this.userProfileHttpClient.lookupReplicas({
      userIds: missing,
    });

    if (remoteReplicas.length > 0) {
      this.metricsService.recordReplicaFallback("findManyByIds");
    }

    for (const remote of remoteReplicas) {
      await this.userReplicaRepo.upsertAsync({
        userId: remote.userId,
        email: remote.email,
        username: remote.username?.toLowerCase() ?? null,
        fullName: remote.fullName,
        displayName: remote.displayName ?? remote.fullName,
        avatarUrl: remote.avatarUrl ?? null,
        isActive: remote.isActive,
      });

      if (remote.isActive) {
        result.set(remote.userId, {
          userId: remote.userId,
          email: remote.email,
          username: remote.username,
          fullName: remote.fullName,
          displayName: remote.displayName,
          avatarUrl: remote.avatarUrl,
          isActive: remote.isActive,
        });
      }
    }

    return result;
  }
}

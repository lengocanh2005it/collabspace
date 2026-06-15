import { Inject, Injectable } from "@nestjs/common";
import { UserProfileHttpClient } from "../../infrastructure/clients/user-profile-http.client";
import {
  type IUserReplicaRepository,
  USER_REPLICA_REPOSITORY_TOKEN,
} from "../ports/IUserReplicaRepository";
import type { UserReplica } from "../../infrastructure/database/schemas/user-replica.schema";
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

  async findActiveMapByIdsAsync(userIds: string[]): Promise<Map<string, UserReplica>> {
    const uniqueIds = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
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

    if (missing.length === 0 || !this.userProfileHttpClient.isFallbackEnabled()) {
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

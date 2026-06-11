import { Inject, Injectable } from '@nestjs/common';
import { USER_PROFILE_REPOSITORY } from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import {
  type LookupUserReplicasInput,
  type UserReplicaLookupDto,
} from '../dto/user-replica-lookup.dto';

@Injectable()
export class LookupUserReplicasUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(
    input: LookupUserReplicasInput,
  ): Promise<UserReplicaLookupDto[]> {
    const userIds = [
      ...new Set((input.userIds ?? []).map((id) => id.trim()).filter(Boolean)),
    ];
    const username = input.username?.trim().toLowerCase();
    const byUserId = new Map<string, UserReplicaLookupDto>();

    if (username) {
      const profile = await this.userProfileRepository.findByUsername(username);

      if (profile) {
        byUserId.set(profile.userId, this.toReplicaDto(profile));
      }
    }

    if (userIds.length > 0) {
      const profiles =
        await this.userProfileRepository.findManyByUserIds(userIds);

      for (const profile of profiles) {
        byUserId.set(profile.userId, this.toReplicaDto(profile));
      }
    }

    return [...byUserId.values()];
  }

  private toReplicaDto(profile: {
    userId: string;
    username: string | null;
    fullName: string;
    displayName: string | null;
    avatarUrl: string | null;
    deletedAt: Date | null;
  }): UserReplicaLookupDto {
    return {
      userId: profile.userId,
      email: `${profile.userId}@users.collabspace.local`,
      username: profile.username?.toLowerCase() ?? null,
      fullName: profile.fullName,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      isActive: profile.deletedAt === null,
    };
  }
}

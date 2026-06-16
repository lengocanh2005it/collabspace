import { Inject, Injectable } from '@nestjs/common';
import { USER_PROFILE_REPOSITORY } from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import {
  type UserProfileResponseDto,
  toUserProfileResponseDto,
} from '../dto/user-profile-response.dto';

@Injectable()
export class BulkGetUserProfilesUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(userIds: string[]): Promise<UserProfileResponseDto[]> {
    const profiles = await this.userProfileRepository.findManyByUserIds(userIds);
    if (profiles.length === 0) {
      return [];
    }

    const statuses = await this.userProfileRepository.getStatusesByUserIds(
      profiles.map((profile) => profile.userId),
    );
    const statusByUserId = new Map(statuses.map((status) => [status.userId, status]));

    return profiles.map((profile) =>
      toUserProfileResponseDto(profile, statusByUserId.get(profile.userId)),
    );
  }
}

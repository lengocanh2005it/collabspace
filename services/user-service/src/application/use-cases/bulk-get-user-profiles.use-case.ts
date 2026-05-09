import { Inject, Injectable } from '@nestjs/common';
import {
  USER_PROFILE_REPOSITORY,
} from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import {
  UserProfileResponseDto,
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
    return profiles.map((profile) => toUserProfileResponseDto(profile));
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USER_PROFILE_REPOSITORY } from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import {
  type UserProfileResponseDto,
  toUserProfileResponseDto,
} from '../dto/user-profile-response.dto';

@Injectable()
export class GetUserProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(userId: string): Promise<UserProfileResponseDto> {
    const profile = await this.userProfileRepository.findByUserId(userId);

    if (!profile || profile.deletedAt) {
      throw new NotFoundException({
        code: 'USER_PROFILE_NOT_FOUND',
        message: `Profile for user ${userId} was not found`,
      });
    }

    return toUserProfileResponseDto(profile);
  }
}

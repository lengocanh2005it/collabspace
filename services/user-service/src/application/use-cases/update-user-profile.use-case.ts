import { Inject, Injectable } from '@nestjs/common';
import {
  UpdateUserProfileInput,
  USER_PROFILE_REPOSITORY,
} from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import {
  UserProfileResponseDto,
  toUserProfileResponseDto,
} from '../dto/user-profile-response.dto';

@Injectable()
export class UpdateUserProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(
    userId: string,
    input: UpdateUserProfileInput,
  ): Promise<UserProfileResponseDto> {
    return toUserProfileResponseDto(
      await this.userProfileRepository.updateProfile(userId, input),
    );
  }
}

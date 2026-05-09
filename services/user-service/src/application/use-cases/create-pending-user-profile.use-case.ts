import { Inject, Injectable } from '@nestjs/common';
import {
  CreatePendingUserProfileInput,
  USER_PROFILE_REPOSITORY,
} from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import { UserProfileResponseDto } from '../dto/user-profile-response.dto';

@Injectable()
export class CreatePendingUserProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(
    input: CreatePendingUserProfileInput,
  ): Promise<UserProfileResponseDto> {
    const profile = await this.userProfileRepository.upsertPending(input);

    return {
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      createdAt: profile.createdAt.toISOString(),
      emailVerified: profile.emailVerified,
      fullName: profile.fullName,
      id: profile.id,
      updatedAt: profile.updatedAt.toISOString(),
      userId: profile.userId,
    };
  }
}

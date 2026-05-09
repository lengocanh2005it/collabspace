import { Inject, Injectable } from '@nestjs/common';
import { USER_PROFILE_REPOSITORY } from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import { UserProfileResponseDto } from '../dto/user-profile-response.dto';

@Injectable()
export class VerifyUserProfileEmailUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(userId: string): Promise<UserProfileResponseDto> {
    const profile = await this.userProfileRepository.markEmailVerified(userId);

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

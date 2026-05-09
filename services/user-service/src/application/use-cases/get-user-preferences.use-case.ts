import { Inject, Injectable } from '@nestjs/common';
import {
  USER_PROFILE_REPOSITORY,
} from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import {
  UserPreferencesResponseDto,
  toUserPreferencesResponseDto,
} from '../dto/user-preferences-response.dto';

@Injectable()
export class GetUserPreferencesUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(userId: string): Promise<UserPreferencesResponseDto> {
    return toUserPreferencesResponseDto(
      await this.userProfileRepository.getPreferences(userId),
    );
  }
}

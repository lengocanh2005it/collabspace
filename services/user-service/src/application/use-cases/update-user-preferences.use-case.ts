import { Inject, Injectable } from '@nestjs/common';
import {
  type UpdateUserPreferencesInput,
  USER_PROFILE_REPOSITORY,
} from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import {
  type UserPreferencesResponseDto,
  toUserPreferencesResponseDto,
} from '../dto/user-preferences-response.dto';

@Injectable()
export class UpdateUserPreferencesUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferencesResponseDto> {
    return toUserPreferencesResponseDto(
      await this.userProfileRepository.updatePreferences(userId, input),
    );
  }
}

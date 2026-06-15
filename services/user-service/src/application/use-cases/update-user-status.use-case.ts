import { Inject, Injectable } from '@nestjs/common';
import {
  type UpdateUserStatusInput,
  USER_PROFILE_REPOSITORY,
} from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import {
  type UserStatusResponseDto,
  toUserStatusResponseDto,
} from '../dto/user-status-response.dto';

@Injectable()
export class UpdateUserStatusUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(userId: string, input: UpdateUserStatusInput): Promise<UserStatusResponseDto> {
    return toUserStatusResponseDto(await this.userProfileRepository.updateStatus(userId, input));
  }
}

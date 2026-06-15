import { Inject, Injectable } from '@nestjs/common';
import { USER_PROFILE_REPOSITORY } from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import {
  type UserStatusResponseDto,
  toUserStatusResponseDto,
} from '../dto/user-status-response.dto';

@Injectable()
export class GetUserStatusesUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(userIds: string[]): Promise<UserStatusResponseDto[]> {
    const statuses = await this.userProfileRepository.getStatusesByUserIds(userIds);
    return statuses.map((status) => toUserStatusResponseDto(status));
  }
}

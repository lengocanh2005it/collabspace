import { Inject, Injectable } from '@nestjs/common';
import {
  type ListUserProfilesInput,
  USER_PROFILE_REPOSITORY,
} from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import type { PaginatedUserSummaryResponseDto } from '../dto/paginated-user-summary-response.dto';
import { toUserSummaryResponseDto } from '../dto/user-summary-response.dto';

@Injectable()
export class ListUserSummariesUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
  ) {}

  async execute(input: ListUserProfilesInput): Promise<PaginatedUserSummaryResponseDto> {
    const result = await this.userProfileRepository.list(input);
    const statuses = await this.userProfileRepository.getStatusesByUserIds(
      result.items.map((profile) => profile.userId),
    );
    const statusMap = new Map(statuses.map((status) => [status.userId, status]));

    return {
      items: result.items.map((profile) =>
        toUserSummaryResponseDto(profile, statusMap.get(profile.userId)),
      ),
      limit: result.limit,
      offset: result.offset,
      total: result.total,
    };
  }
}

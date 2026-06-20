import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  type UpdateUserProfileInput,
  USER_PROFILE_REPOSITORY,
} from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import { type IUnitOfWork, UNIT_OF_WORK } from '../../domain/ports/unit-of-work.port';
import {
  type UserProfileResponseDto,
  toUserProfileResponseDto,
} from '../dto/user-profile-response.dto';
import { UserOutboxService } from '../../infrastructure/outbox/user-outbox.service';

@Injectable()
export class UpdateUserProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: IUnitOfWork,
    private readonly userOutboxService: UserOutboxService,
  ) {}

  async execute(userId: string, input: UpdateUserProfileInput): Promise<UserProfileResponseDto> {
    const occurredAt = new Date().toISOString();

    const updatedProfile = await this.unitOfWork.run(async (context) => {
      const profile = await this.userProfileRepository.updateProfileInTransaction(
        context,
        userId,
        input,
      );

      await this.userOutboxService.enqueueProfileUpdated(
        {
          userId,
          fullName: profile.fullName,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          username: profile.username,
          isActive: profile.deletedAt === null,
          occurredAt,
        },
        context.manager as EntityManager,
      );

      return profile;
    });

    return toUserProfileResponseDto(updatedProfile);
  }
}

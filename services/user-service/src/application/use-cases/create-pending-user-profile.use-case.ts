import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  type CreatePendingUserProfileInput,
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
export class CreatePendingUserProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: IUnitOfWork,
    private readonly userOutboxService: UserOutboxService,
  ) {}

  async execute(input: CreatePendingUserProfileInput): Promise<UserProfileResponseDto> {
    const occurredAt = new Date().toISOString();
    const normalizedEmail = input.email?.trim().toLowerCase();

    const profile = await this.unitOfWork.run(async (context) => {
      const upserted = await this.userProfileRepository.upsertPendingInTransaction(context, input);
      const email = normalizedEmail || `${upserted.userId}@users.collabspace.local`;

      await this.userOutboxService.enqueueUserRegistered(
        {
          userId: upserted.userId,
          fullName: upserted.fullName,
          email,
          username: upserted.username,
          displayName: upserted.displayName,
          avatarUrl: upserted.avatarUrl,
          occurredAt,
        },
        context.manager as EntityManager,
      );

      return upserted;
    });

    return toUserProfileResponseDto(profile);
  }
}

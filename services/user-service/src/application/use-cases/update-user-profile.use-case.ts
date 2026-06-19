import { Inject, Injectable, Logger } from '@nestjs/common';
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
import { RabbitMqEventsService } from '../../infrastructure/messaging/rabbitmq/rabbitmq-events.service';
import { shouldPublishUserEventsToRabbitMq } from '../../infrastructure/outbox/user-outbox.config';
import { UserOutboxService } from '../../infrastructure/outbox/user-outbox.service';

@Injectable()
export class UpdateUserProfileUseCase {
  private readonly logger = new Logger(UpdateUserProfileUseCase.name);

  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: IUnitOfWork,
    private readonly userOutboxService: UserOutboxService,
    private readonly rabbitMqEvents: RabbitMqEventsService,
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

    if (shouldPublishUserEventsToRabbitMq()) {
      try {
        await this.rabbitMqEvents.publishUserProfileUpdated({
          userId,
          fullName: updatedProfile.fullName,
          displayName: updatedProfile.displayName,
          avatarUrl: updatedProfile.avatarUrl,
          username: updatedProfile.username,
          isActive: updatedProfile.deletedAt === null,
          occurredAt,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to publish profile updated event for ${userId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return toUserProfileResponseDto(updatedProfile);
  }
}

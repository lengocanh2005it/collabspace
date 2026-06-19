import { Inject, Injectable, Logger } from '@nestjs/common';
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
import { RabbitMqEventsService } from '../../infrastructure/messaging/rabbitmq/rabbitmq-events.service';
import { shouldPublishUserEventsToRabbitMq } from '../../infrastructure/outbox/user-outbox.config';
import { UserOutboxService } from '../../infrastructure/outbox/user-outbox.service';

@Injectable()
export class CreatePendingUserProfileUseCase {
  private readonly logger = new Logger(CreatePendingUserProfileUseCase.name);

  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: IUnitOfWork,
    private readonly userOutboxService: UserOutboxService,
    private readonly rabbitMqEvents: RabbitMqEventsService,
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

    if (shouldPublishUserEventsToRabbitMq()) {
      try {
        await this.rabbitMqEvents.publishUserRegistered({
          userId: profile.userId,
          fullName: profile.fullName,
          email: normalizedEmail || `${profile.userId}@users.collabspace.local`,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          occurredAt,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to publish user registered event for ${profile.userId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return toUserProfileResponseDto(profile);
  }
}

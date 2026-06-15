import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type CreatePendingUserProfileInput,
  USER_PROFILE_REPOSITORY,
} from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import {
  type UserProfileResponseDto,
  toUserProfileResponseDto,
} from '../dto/user-profile-response.dto';
import { RabbitMqEventsService } from '../../infrastructure/messaging/rabbitmq/rabbitmq-events.service';

@Injectable()
export class CreatePendingUserProfileUseCase {
  private readonly logger = new Logger(CreatePendingUserProfileUseCase.name);

  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
    private readonly rabbitMqEvents: RabbitMqEventsService,
  ) {}

  async execute(input: CreatePendingUserProfileInput): Promise<UserProfileResponseDto> {
    const profile = await this.userProfileRepository.upsertPending(input);

    try {
      await this.rabbitMqEvents.publishUserRegistered({
        userId: profile.userId,
        fullName: profile.fullName,
        email: `${profile.userId}@users.collabspace.local`,
        username: profile.username,
        occurredAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to publish user registered event for ${profile.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return toUserProfileResponseDto(profile);
  }
}

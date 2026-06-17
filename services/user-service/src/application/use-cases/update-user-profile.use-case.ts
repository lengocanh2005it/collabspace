import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type UpdateUserProfileInput,
  USER_PROFILE_REPOSITORY,
} from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import {
  type UserProfileResponseDto,
  toUserProfileResponseDto,
} from '../dto/user-profile-response.dto';
import { RabbitMqEventsService } from '../../infrastructure/messaging/rabbitmq/rabbitmq-events.service';

@Injectable()
export class UpdateUserProfileUseCase {
  private readonly logger = new Logger(UpdateUserProfileUseCase.name);

  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
    private readonly rabbitMqEvents: RabbitMqEventsService,
  ) {}

  async execute(userId: string, input: UpdateUserProfileInput): Promise<UserProfileResponseDto> {
    const updatedProfile = await this.userProfileRepository.updateProfile(userId, input);

    try {
      await this.rabbitMqEvents.publishUserProfileUpdated({
        userId,
        fullName: updatedProfile.fullName,
        displayName: updatedProfile.displayName,
        avatarUrl: updatedProfile.avatarUrl,
        username: updatedProfile.username,
        isActive: updatedProfile.deletedAt === null,
        occurredAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to publish profile updated event for ${userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return toUserProfileResponseDto(updatedProfile);
  }
}

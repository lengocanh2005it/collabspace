import { Inject, Injectable } from '@nestjs/common';
import {
  UpdateUserProfileInput,
  USER_PROFILE_REPOSITORY,
} from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import {
  UserProfileResponseDto,
  toUserProfileResponseDto,
} from '../dto/user-profile-response.dto';
import { RabbitMqEventsService } from '../../infrastructure/messaging/rabbitmq/rabbitmq-events.service';

@Injectable()
export class UpdateUserProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: UserProfileRepository,
    private readonly rabbitMqEvents: RabbitMqEventsService,
  ) {}

  async execute(
    userId: string,
    input: UpdateUserProfileInput,
  ): Promise<UserProfileResponseDto> {
    const updatedProfile = await this.userProfileRepository.updateProfile(userId, input);
try {
      await this.rabbitMqEvents.publishUserProfileUpdated({
        userId: userId,
        fullName: updatedProfile.fullName,
        displayName: updatedProfile.displayName,
        avatarUrl: updatedProfile.coverUrl || null,
      });
      
        console.log('RabbitMQ Published');
    } catch (error) {
      console.error('RabbitMQ Publish Error:', error);
    }
    return toUserProfileResponseDto(updatedProfile);
  }
}

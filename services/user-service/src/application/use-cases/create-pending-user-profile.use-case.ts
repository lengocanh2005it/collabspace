// src/application/usecases/create-pending-user-profile.usecase.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CreatePendingUserProfileInput, USER_PROFILE_REPOSITORY } from '../../domain/repositories/user-profile.repository';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import { UserProfileResponseDto, toUserProfileResponseDto } from '../dto/user-profile-response.dto';
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

    // Bắn Event Đăng ký (Chỉ có ID và Tên)
    try {
      await this.rabbitMqEvents.publishUserRegistered({
        userId: profile.userId,
        fullName: profile.fullName,
      });
    } catch (error) {
  console.error(error);
}

    return toUserProfileResponseDto(profile);
  }
}
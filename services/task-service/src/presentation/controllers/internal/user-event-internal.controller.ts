// src/presentation/controllers/internal/user-event.controller.ts
import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import { CommandBus } from "@nestjs/cqrs";
import type { Channel, ConsumeMessage } from "amqplib";

// Import Command
import { SyncUserReplicaCommand } from "../../../application/commands/sync-user-replica.command";
import { CreateUserReplicaCommand } from "../../../application/commands/create-user-replica.command";
import { USER_PROFILE_UPDATED_EVENT } from "../../../domain/events/user-profile-update.event";
import { USER_REGISTERED_EVENT } from "../../../domain/events/user-create.event";
import { type UserProfileUpdatedEventPayload } from "../../../domain/events/user-profile-update.event";
import { type UserRegisteredEventPayload } from "../../../domain/events/user-create.event";

@Controller()
export class UserEventController {
  private readonly logger = new Logger(UserEventController.name);

  constructor(private readonly commandBus: CommandBus) {}

  // Làn 1: Nghe sự kiện Đăng ký -> Gọi Command Khởi tạo
  @EventPattern(USER_REGISTERED_EVENT)
  async handleUserRegistered(
    @Payload() data: UserRegisteredEventPayload,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const originalMessage = context.getMessage() as ConsumeMessage;

    try {
      await this.commandBus.execute(
        new CreateUserReplicaCommand(
          data.userId,
          data.fullName,
          data.email,
          data.username,
          data.displayName,
          data.avatarUrl,
        ),
      );
      channel.ack(originalMessage);
    } catch (error) {
      this.logger.error(
        `Failed to sync user registration event for ${data.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  // Làn 2: Nghe sự kiện Cập nhật -> Gọi Command Cập nhật
  @EventPattern(USER_PROFILE_UPDATED_EVENT)
  async handleUserUpdated(
    @Payload() data: UserProfileUpdatedEventPayload,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const originalMessage = context.getMessage() as ConsumeMessage;

    try {
      await this.commandBus.execute(
        new SyncUserReplicaCommand(
          data.userId,
          data.fullName || "",
          data.displayName || undefined,
          data.avatarUrl || undefined,
          data.username || undefined,
          data.email,
        ),
      );
      channel.ack(originalMessage);
    } catch (error) {
      this.logger.error(
        `Failed to sync user profile update event for ${data.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

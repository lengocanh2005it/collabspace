// src/presentation/controllers/internal/user-event.controller.ts
import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import { CommandBus } from "@nestjs/cqrs";

// Import Command
import { SyncUserReplicaCommand } from "../../../application/commands/sync-user-replica.command";
import { CreateUserReplicaCommand } from "../../../application/commands/create-user-replica.command";
import {
  UserProfileUpdatedEventPayload,
  USER_PROFILE_UPDATED_EVENT,
} from "../../../domain/events/user-profile-update.event";
import {
  UserRegisteredEventPayload,
  USER_REGISTERED_EVENT,
} from "../../../domain/events/user-create.event";

@Controller()
export class UserEventController {
  constructor(private readonly commandBus: CommandBus) {}

  // Làn 1: Nghe sự kiện Đăng ký -> Gọi Command Khởi tạo
  @EventPattern(USER_REGISTERED_EVENT)
  async handleUserRegistered(
    @Payload() data: UserRegisteredEventPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    try {
      await this.commandBus.execute(
        new CreateUserReplicaCommand(data.userId, data.fullName),
      );
      channel.ack(context.getMessage());
    } catch (e) {
      /* log error */
    }
  }

  // Làn 2: Nghe sự kiện Cập nhật -> Gọi Command Cập nhật
  @EventPattern(USER_PROFILE_UPDATED_EVENT)
  async handleUserUpdated(
    @Payload() data: UserProfileUpdatedEventPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    try {
      await this.commandBus.execute(
        new SyncUserReplicaCommand(
          data.userId,
          data.fullName || "", // Đảm bảo luôn là string
          data.displayName || undefined,
          data.avatarUrl || undefined,
        ),
      );
      channel.ack(context.getMessage());
    } catch (e) {
      /* log error */
    }
  }
}

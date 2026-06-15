// src/presentation/controllers/internal/user-event.controller.ts
import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, type RmqContext } from "@nestjs/microservices";
import { CommandBus } from "@nestjs/cqrs";
import type { Channel, ConsumeMessage } from "amqplib";

import { SyncUserReplicaCommand } from "../../../application/commands/sync-user-replica.command";
import { CreateUserReplicaCommand } from "../../../application/commands/create-user-replica.command";
import { USER_PROFILE_UPDATED_EVENT } from "../../../domain/events/user-profile-update.event";
import { USER_REGISTERED_EVENT } from "../../../domain/events/user-create.event";
import type { UserProfileUpdatedEventPayload } from "../../../domain/events/user-profile-update.event";
import type { UserRegisteredEventPayload } from "../../../domain/events/user-create.event";
import { MetricsService } from "../../../metrics/metrics.service";

@Controller()
export class UserEventController {
  private readonly logger = new Logger(UserEventController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly metricsService: MetricsService,
  ) {}

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
      this.recordSyncLag(data.occurredAt);
      channel.ack(originalMessage);
    } catch (error) {
      this.logger.error(
        `Failed to sync user registration event for ${data.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

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
          data.isActive,
        ),
      );
      this.recordSyncLag(data.occurredAt);
      channel.ack(originalMessage);
    } catch (error) {
      this.logger.error(
        `Failed to sync user profile update event for ${data.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private recordSyncLag(occurredAt?: string): void {
    if (!occurredAt) {
      return;
    }

    const eventTime = new Date(occurredAt).getTime();

    if (Number.isNaN(eventTime)) {
      return;
    }

    const lagSeconds = Math.max(0, (Date.now() - eventTime) / 1000);
    this.metricsService.recordReplicaSyncLag(lagSeconds, "event");
  }
}

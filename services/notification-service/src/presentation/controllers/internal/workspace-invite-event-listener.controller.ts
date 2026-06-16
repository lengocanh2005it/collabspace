import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, type RmqContext } from "@nestjs/microservices";
import { CommandBus } from "@nestjs/cqrs";
import type { Channel, ConsumeMessage } from "amqplib";
import { WORKSPACE_INVITED_EVENT } from "../../../domain/events/workspace-events";
import type { WorkspaceInvitedEventPayload } from "../../../domain/events/workspace-events";
import { InboundNotificationEventMapper } from "../../../application/mappers/inbound-notification-event.mapper";
import { UserReplicaLookupService } from "../../../application/services/user-replica-lookup.service";
import { consumeNotificationEvent } from "../../helpers/rmq-notification-consumer.helper";

@Controller()
export class WorkspaceInviteEventListenerController {
  private readonly logger = new Logger(WorkspaceInviteEventListenerController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly userReplicaLookup: UserReplicaLookupService,
  ) {}

  @EventPattern(WORKSPACE_INVITED_EVENT)
  async handleWorkspaceInvited(
    @Payload() data: WorkspaceInvitedEventPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMessage = context.getMessage() as ConsumeMessage;
    const resolvedPayload = await this.resolveInviteRecipient(data);
    const command = InboundNotificationEventMapper.toWorkspaceInvitedCommand(resolvedPayload);

    if (!command) {
      this.logger.warn(
        `Skipping workspace_invited notification without recipient user id for workspaceId=${data.workspaceId} inviteEmail=${data.inviteEmail ?? "unknown"}`,
      );
      channel.ack(originalMessage);
      return;
    }

    await consumeNotificationEvent(
      {
        commandBus: this.commandBus,
        channel,
        message: originalMessage,
        logger: this.logger,
        eventLabel: "workspace_invited",
      },
      command,
    );
  }

  private async resolveInviteRecipient(
    data: WorkspaceInvitedEventPayload,
  ): Promise<WorkspaceInvitedEventPayload> {
    if (data.recipientId?.trim() || data.invitedUserId?.trim() || !data.inviteEmail?.trim()) {
      return data;
    }

    const recipientId = await this.userReplicaLookup.findActiveUserIdByEmailAsync(data.inviteEmail);
    if (!recipientId) {
      return data;
    }

    return { ...data, recipientId };
  }
}

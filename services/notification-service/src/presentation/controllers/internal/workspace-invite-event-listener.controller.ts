import { Controller, Logger } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { Ctx, EventPattern, Payload, type RmqContext } from "@nestjs/microservices";
import type { Channel, ConsumeMessage } from "amqplib";
import { WORKSPACE_INVITED_EVENT } from "../../../domain/events/workspace-events";
import type { WorkspaceInvitedEventPayload } from "../../../domain/events/workspace-events";
import { WorkspaceInviteNotificationService } from "../../../application/services/workspace-invite-notification.service";
import { consumeNotificationEvent } from "../../helpers/rmq-notification-consumer.helper";

@Controller()
export class WorkspaceInviteEventListenerController {
  private readonly logger = new Logger(WorkspaceInviteEventListenerController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly workspaceInviteNotification: WorkspaceInviteNotificationService,
  ) {}

  @EventPattern(WORKSPACE_INVITED_EVENT)
  async handleWorkspaceInvited(
    @Payload() data: WorkspaceInvitedEventPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMessage = context.getMessage() as ConsumeMessage;
    const command = await this.workspaceInviteNotification.prepareWorkspaceInvitedCommand(data);

    if (!command) {
      this.logger.warn(
        `Skipping workspace_invited via rmq without recipient user id for workspaceId=${data.workspaceId} inviteEmail=${data.inviteEmail ?? "unknown"}`,
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
        eventLabel: "workspace_invited (rmq)",
      },
      command,
    );
  }
}

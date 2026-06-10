import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import { CommandBus } from "@nestjs/cqrs";
import type { Channel, ConsumeMessage } from "amqplib";
import { CreateNotificationCommand } from "../../../application/usecases/create-notification/create-notification.command";
import { NotificationType } from "../../../domain/value-objects/NotificationType";
import { WORKSPACE_INVITED_EVENT } from "../../../domain/events/workspace-events";
import type { WorkspaceInvitedEventPayload } from "../../../domain/events/workspace-events";

@Controller()
export class WorkspaceInviteEventListenerController {
  private readonly logger = new Logger(
    WorkspaceInviteEventListenerController.name,
  );

  constructor(private readonly commandBus: CommandBus) {}

  @EventPattern(WORKSPACE_INVITED_EVENT)
  async handleWorkspaceInvited(
    @Payload() data: WorkspaceInvitedEventPayload,
    @Ctx() context: RmqContext,
  ) {
    try {
      await this.commandBus.execute(
        new CreateNotificationCommand(
          data.invitedUserId,
          data.invitedById,
          NotificationType.WORKSPACE_INVITED,
          "Lời mời vào workspace",
          `${data.invitedByName} đã mời bạn vào workspace "${data.workspaceName}"`,
          data.workspaceId,
          "WORKSPACE",
          {
            workspaceName: data.workspaceName,
            invitedByName: data.invitedByName,
            invitedByAvatarUrl: data.invitedByAvatarUrl,
            role: data.role,
            inviteEmail: data.inviteEmail,
          },
        ),
      );

      const channel = context.getChannelRef() as Channel;
      const originalMessage = context.getMessage() as ConsumeMessage;
      channel.ack(originalMessage);
    } catch (error) {
      this.logger.error(
        "❌ Lỗi khi xử lý event workspace_invited",
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

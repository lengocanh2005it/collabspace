import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, type RmqContext } from "@nestjs/microservices";
import { CommandBus } from "@nestjs/cqrs";
import type { Channel, ConsumeMessage } from "amqplib";
import {
  WORKSPACE_DELETED_EVENT,
  type WorkspaceDeletedEventPayload,
} from "../../../domain/events/workspace-events";
import { InboundNotificationEventMapper } from "../../../application/mappers/inbound-notification-event.mapper";
import { consumeNotificationEvent } from "../../helpers/rmq-notification-consumer.helper";

@Controller()
export class WorkspaceDeleteEventListenerController {
  private readonly logger = new Logger(WorkspaceDeleteEventListenerController.name);

  constructor(private readonly commandBus: CommandBus) {}

  @EventPattern(WORKSPACE_DELETED_EVENT)
  async handleWorkspaceDeleted(
    @Payload() data: WorkspaceDeletedEventPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMessage = context.getMessage() as ConsumeMessage;

    this.logger.log(`📥 Nhận được event xóa workspace: ${data.workspaceId}`);

    // deletedById is the actor; recipientId = same (notify the deleter is not useful,
    // but currently the payload only carries workspaceId + deletedById).
    // When workspace-service adds member list to the payload, update recipient logic here.
    await consumeNotificationEvent(
      {
        commandBus: this.commandBus,
        channel,
        message: originalMessage,
        logger: this.logger,
        eventLabel: "workspace_deleted",
      },
      InboundNotificationEventMapper.toWorkspaceDeletedCommand(data, data.deletedById),
    );
  }
}

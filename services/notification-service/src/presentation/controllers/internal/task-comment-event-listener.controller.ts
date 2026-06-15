import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, type RmqContext } from "@nestjs/microservices";
import type { CommandBus } from "@nestjs/cqrs";
import type { Channel, ConsumeMessage } from "amqplib";
import { TASK_COMMENTED_EVENT } from "../../../domain/events/comment-events";
import type { TaskCommentedEventPayload } from "../../../domain/events/comment-events";
import { InboundNotificationEventMapper } from "../../../application/mappers/inbound-notification-event.mapper";
import { consumeNotificationEvent } from "../../helpers/rmq-notification-consumer.helper";

@Controller()
export class CommentEventListenerController {
  private readonly logger = new Logger(CommentEventListenerController.name);

  constructor(private readonly commandBus: CommandBus) {}

  @EventPattern(TASK_COMMENTED_EVENT)
  async handleTaskCommented(
    @Payload() data: TaskCommentedEventPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as ConsumeMessage;

    this.logger.log(`📥 [RABBITMQ] Bắt được event comment cho Task: ${data.taskId}`);

    await consumeNotificationEvent(
      {
        commandBus: this.commandBus,
        channel,
        message: originalMsg,
        logger: this.logger,
        eventLabel: "task_commented",
      },
      InboundNotificationEventMapper.toTaskCommentedCommand(data),
    );
  }
}

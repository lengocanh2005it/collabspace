import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import { CommandBus } from "@nestjs/cqrs";
import type { Channel, ConsumeMessage } from "amqplib";
import { COMMENT_MENTIONED_EVENT } from "../../../domain/events/comment-events";
import type { CommentMentionedNotificationPayload } from "../../../domain/events/comment-events";
import { InboundNotificationEventMapper } from "../../../application/mappers/inbound-notification-event.mapper";
import { consumeNotificationEvent } from "../../helpers/rmq-notification-consumer.helper";

@Controller()
export class CommentMentionEventListenerController {
  private readonly logger = new Logger(
    CommentMentionEventListenerController.name,
  );

  constructor(private readonly commandBus: CommandBus) {}

  @EventPattern(COMMENT_MENTIONED_EVENT)
  async handleCommentMentioned(
    @Payload() data: CommentMentionedNotificationPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as ConsumeMessage;

    await consumeNotificationEvent(
      {
        commandBus: this.commandBus,
        channel,
        message: originalMsg,
        logger: this.logger,
        eventLabel: "comment_mentioned",
      },
      InboundNotificationEventMapper.toCommentMentionedCommand(data),
    );
  }
}

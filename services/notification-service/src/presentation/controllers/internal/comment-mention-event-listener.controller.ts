import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import { CommandBus } from "@nestjs/cqrs";
import type { Channel, ConsumeMessage } from "amqplib";
import { COMMENT_MENTIONED_EVENT } from "../../../domain/events/comment-events";
import type { CommentMentionedNotificationPayload } from "../../../domain/events/comment-events";
import { CreateNotificationCommand } from "../../../application/usecases/create-notification/create-notification.command";
import { NotificationType } from "../../../domain/value-objects/NotificationType";

@Controller()
export class CommentMentionEventListenerController {
  private readonly logger = new Logger(CommentMentionEventListenerController.name);

  constructor(private readonly commandBus: CommandBus) {}

  @EventPattern(COMMENT_MENTIONED_EVENT)
  async handleCommentMentioned(
    @Payload() data: CommentMentionedNotificationPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as ConsumeMessage;

    try {
      const eventId =
        data.eventId ??
        `comment_mentioned:${data.commentId}:${data.recipientId}`;

      const command = new CreateNotificationCommand(
        data.recipientId,
        data.actorId,
        NotificationType.COMMENT_MENTIONED,
        "Bạn được nhắc trong bình luận",
        `${data.actorName} đã nhắc bạn: "${data.commentPreview}"`,
        data.taskId,
        "TASK",
        {
          actorName: data.actorName,
          actorAvatarUrl: data.actorAvatarUrl,
          taskTitle: data.taskTitle,
          commentId: data.commentId,
          timestamp: data.createdAt,
        },
        eventId,
      );

      await this.commandBus.execute(command);
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(
        "Failed to process comment_mentioned event",
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

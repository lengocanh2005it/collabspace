import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import type { Channel, ConsumeMessage } from "amqplib";
import type { TaskAssignedEventPayload } from "../../../domain/events";
import { CommandBus } from "@nestjs/cqrs";
import { InboundNotificationEventMapper } from "../../../application/mappers/inbound-notification-event.mapper";
import { consumeNotificationEvent } from "../../helpers/rmq-notification-consumer.helper";

@Controller()
export class TaskEventController {
  private readonly logger = new Logger(TaskEventController.name);

  constructor(private readonly commandBus: CommandBus) {}

  @EventPattern("task_assigned")
  async handleTaskAssignedEvent(
    @Payload() data: TaskAssignedEventPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as ConsumeMessage;

    this.logger.log(
      `📥 Nhận được event giao task cho User: ${data.recipientId}`,
    );

    await consumeNotificationEvent(
      {
        commandBus: this.commandBus,
        channel,
        message: originalMsg,
        logger: this.logger,
        eventLabel: "task_assigned",
      },
      InboundNotificationEventMapper.toTaskAssignedCommand(data),
    );
  }
}

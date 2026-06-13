import type { Logger } from "@nestjs/common";
import type { CommandBus } from "@nestjs/cqrs";
import type { Channel, ConsumeMessage } from "amqplib";
import { CreateNotificationCommand } from "../../application/usecases/create-notification/create-notification.command";

export type RmqNotificationConsumerDeps = {
  commandBus: CommandBus;
  channel: Channel;
  message: ConsumeMessage;
  logger: Logger;
  eventLabel: string;
};

/**
 * Template Method: ack/nack wrapper for notification event consumers.
 */
export async function consumeNotificationEvent(
  deps: RmqNotificationConsumerDeps,
  command: CreateNotificationCommand,
): Promise<void> {
  try {
    await deps.commandBus.execute(command);
    deps.channel.ack(deps.message);
  } catch (error) {
    deps.logger.error(
      `Failed to process ${deps.eventLabel} event`,
      error instanceof Error ? error.stack : undefined,
    );
    deps.channel.nack(deps.message, false, true);
  }
}

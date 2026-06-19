import type { Logger } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import type { Channel, ConsumeMessage } from "amqplib";
import { handleRmqConsumerFailure } from "@collabspace/shared";
import type { RmqChannel, RmqConsumeMessage } from "@collabspace/shared";
import type { CreateNotificationCommand } from "../../application/usecases/create-notification/create-notification.command";
import { resolveCommandTimeoutMs, withCommandTimeout } from "./notification-command.helper";

export type RmqNotificationConsumerDeps = {
  commandBus: CommandBus;
  channel: Channel;
  message: ConsumeMessage;
  logger: Logger;
  eventLabel: string;
  maxRetries?: number;
};

function resolveMaxRetries(maxRetries?: number): number {
  if (maxRetries != null && Number.isFinite(maxRetries)) {
    return Math.max(1, Math.floor(maxRetries));
  }

  return Number(process.env.RABBITMQ_MAX_RETRIES ?? 5);
}

/**
 * Template Method: ack / retry / DLQ wrapper for notification event consumers.
 */
export async function consumeNotificationEvent(
  deps: RmqNotificationConsumerDeps,
  command: CreateNotificationCommand,
): Promise<void> {
  try {
    await withCommandTimeout(deps.commandBus.execute(command), resolveCommandTimeoutMs());
    deps.channel.ack(deps.message);
  } catch (error) {
    deps.logger.error(
      `Failed to process ${deps.eventLabel} event`,
      error instanceof Error ? error.stack : undefined,
    );
    handleRmqConsumerFailure(
      deps.channel as unknown as RmqChannel,
      deps.message as unknown as RmqConsumeMessage,
      resolveMaxRetries(deps.maxRetries),
    );
  }
}

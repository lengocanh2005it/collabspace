import type { Logger } from "@nestjs/common";
import type { CommandBus } from "@nestjs/cqrs";
import type { Channel, ConsumeMessage } from "amqplib";
import { handleRmqConsumerFailure } from "@collabspace/shared";
import type { RmqChannel, RmqConsumeMessage } from "@collabspace/shared";
import { CreateNotificationCommand } from "../../application/usecases/create-notification/create-notification.command";

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

function resolveCommandTimeoutMs(): number {
  return Number(process.env.COMMAND_TIMEOUT_MS ?? 10000);
}

function withCommandTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Command timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timer),
  );
}

/**
 * Template Method: ack / retry / DLQ wrapper for notification event consumers.
 */
export async function consumeNotificationEvent(
  deps: RmqNotificationConsumerDeps,
  command: CreateNotificationCommand,
): Promise<void> {
  try {
    await withCommandTimeout(
      deps.commandBus.execute(command),
      resolveCommandTimeoutMs(),
    );
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

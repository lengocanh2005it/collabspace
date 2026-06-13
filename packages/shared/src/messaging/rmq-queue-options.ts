export const COLLABSPACE_DLX_EXCHANGE = 'collabspace_dlx';

export type ConsumerQueueOptionsInput = {
  durable?: boolean;
  deadLetterExchange?: string;
  deadLetterRoutingKey?: string;
};

/** DLQ routing key convention used across CollabSpace consumer queues. */
export function defaultDlqRoutingKey(queueName: string): string {
  return `${queueName}.dlq`;
}

/**
 * NestJS RMQ `queueOptions` with dead-letter exchange (DLX) for consumer queues.
 * All services must use the same shape so RabbitMQ queue declare stays idempotent.
 */
export function buildConsumerQueueOptions(
  input: ConsumerQueueOptionsInput = {},
): { durable: boolean; arguments?: Record<string, string> } {
  const durable = input.durable ?? true;
  const deadLetterExchange =
    input.deadLetterExchange ?? COLLABSPACE_DLX_EXCHANGE;
  const deadLetterRoutingKey = input.deadLetterRoutingKey;

  if (!deadLetterRoutingKey) {
    return { durable };
  }

  return {
    durable,
    arguments: {
      'x-dead-letter-exchange': deadLetterExchange,
      'x-dead-letter-routing-key': deadLetterRoutingKey,
    },
  };
}

export function buildConsumerQueueOptionsForQueue(
  queueName: string,
  input: Omit<ConsumerQueueOptionsInput, 'deadLetterRoutingKey'> = {},
): { durable: boolean; arguments?: Record<string, string> } {
  return buildConsumerQueueOptions({
    ...input,
    deadLetterRoutingKey: defaultDlqRoutingKey(queueName),
  });
}

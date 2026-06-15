export type RmqConsumeMessage = {
  content: Uint8Array | ArrayBufferView;
  fields: {
    deliveryTag: number;
    exchange: string;
    routingKey: string;
    redelivered: boolean;
  };
  properties: {
    headers?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

export type RmqChannel = {
  ack(message: RmqConsumeMessage, allUpTo?: boolean): void;
  nack(message: RmqConsumeMessage, allUpTo?: boolean, requeue?: boolean): void;
  publish(
    exchange: string,
    routingKey: string,
    content: RmqConsumeMessage['content'],
    options?: Record<string, unknown>,
  ): boolean;
};

const RETRY_COUNT_HEADER = 'x-retry-count';

export function getRmqRetryCount(message: RmqConsumeMessage): number {
  const headers = message.properties.headers ?? {};
  const custom = headers[RETRY_COUNT_HEADER];

  if (typeof custom === 'number' && Number.isFinite(custom)) {
    return Math.max(0, Math.floor(custom));
  }

  if (typeof custom === 'string') {
    const parsed = Number.parseInt(custom, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  const xDeath = headers['x-death'] as Array<{ count?: number }> | undefined;
  if (Array.isArray(xDeath)) {
    return xDeath.reduce((sum, entry) => sum + (entry.count ?? 0), 0);
  }

  return 0;
}

export function shouldSendRmqMessageToDlq(message: RmqConsumeMessage, maxRetries: number): boolean {
  const safeMaxRetries = Number.isFinite(maxRetries) ? Math.max(1, Math.floor(maxRetries)) : 5;

  return getRmqRetryCount(message) >= safeMaxRetries;
}

/**
 * Retry transient consumer failures with x-retry-count; route to DLQ after max attempts.
 */
export function handleRmqConsumerFailure(
  channel: RmqChannel,
  message: RmqConsumeMessage,
  maxRetries: number,
): void {
  const safeMaxRetries = Number.isFinite(maxRetries) ? Math.max(1, Math.floor(maxRetries)) : 5;
  const retryCount = getRmqRetryCount(message);

  if (retryCount >= safeMaxRetries) {
    channel.nack(message, false, false);
    return;
  }

  channel.ack(message);
  channel.publish(message.fields.exchange, message.fields.routingKey, message.content, {
    ...message.properties,
    headers: {
      ...(message.properties.headers ?? {}),
      [RETRY_COUNT_HEADER]: retryCount + 1,
    },
  });
}

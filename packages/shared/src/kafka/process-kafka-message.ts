import { buildKafkaDlqEnvelope, type KafkaDlqEnvelope } from './dlq-envelope';
import { retryWithBackoff } from './consumer-retry';

export type KafkaConsumerMessageContext = {
  topic: string;
  partition: number;
  offset: string;
  key: Buffer | null;
  value: Buffer | null;
};

export type KafkaConsumerLogger = {
  warn(message: string): void;
  error(message: string, stack?: string): void;
};

export type ProcessKafkaConsumerMessageOptions = {
  context: KafkaConsumerMessageContext;
  consumerGroup?: string;
  maxRetries: number;
  retryDelayMs: number;
  publishToDlq: (envelope: KafkaDlqEnvelope) => Promise<void>;
  log: KafkaConsumerLogger;
  parseValue: (value: Buffer | null) => Record<string, unknown> | null;
  handler: (record: Record<string, unknown>, topic: string) => Promise<void>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Parse → retry handler → on failure publish DLQ envelope (offset committed by caller).
 * Mirrors former RabbitMQ DLQ semantics without blocking the consumer group.
 */
export async function processKafkaConsumerMessage(
  options: ProcessKafkaConsumerMessageOptions,
): Promise<void> {
  const {
    context,
    parseValue,
    handler,
    maxRetries,
    retryDelayMs,
    publishToDlq,
    log,
    consumerGroup,
  } = options;
  const record = parseValue(context.value);

  if (!record) {
    await publishToDlq(
      buildKafkaDlqEnvelope({
        sourceTopic: context.topic,
        partition: context.partition,
        offset: context.offset,
        key: context.key?.toString('utf8'),
        payload: context.value?.toString('utf8') ?? null,
        errorMessage: 'Invalid or empty JSON payload',
        failedAt: new Date().toISOString(),
        consumerGroup,
      }),
    );
    log.warn(
      `Sent unparseable Kafka message to DLQ topic=${context.topic} offset=${context.offset}`,
    );
    return;
  }

  try {
    await retryWithBackoff(() => handler(record, context.topic), {
      maxRetries,
      retryDelayMs,
      onRetry: (attempt, error) => {
        log.warn(
          `Kafka handler retry ${attempt}/${maxRetries} topic=${context.topic} offset=${context.offset}: ${errorMessage(error)}`,
        );
      },
    });
  } catch (error) {
    const message = errorMessage(error);
    await publishToDlq(
      buildKafkaDlqEnvelope({
        sourceTopic: context.topic,
        partition: context.partition,
        offset: context.offset,
        key: context.key?.toString('utf8'),
        payload: record,
        errorMessage: message,
        failedAt: new Date().toISOString(),
        consumerGroup,
      }),
    );
    log.error(
      `Sent failed Kafka message to DLQ topic=${context.topic} offset=${context.offset}: ${message}`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}

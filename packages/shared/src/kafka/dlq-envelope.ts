/** Dead-letter envelope published to `collabspace.dlq.events` when a consumer exhausts retries. */
export type KafkaDlqEnvelope = {
  version: 1;
  sourceTopic: string;
  partition: number;
  offset: string;
  key?: string;
  payload: unknown;
  errorMessage: string;
  failedAt: string;
  consumerGroup?: string;
};

export const DEFAULT_KAFKA_DLQ_TOPIC = 'collabspace.dlq.events';

export function buildKafkaDlqEnvelope(input: {
  sourceTopic: string;
  partition: number;
  offset: string;
  key?: string;
  payload: unknown;
  errorMessage: string;
  failedAt: string;
  consumerGroup?: string;
}): KafkaDlqEnvelope {
  return {
    version: 1,
    sourceTopic: input.sourceTopic,
    partition: input.partition,
    offset: input.offset,
    key: input.key,
    payload: input.payload,
    errorMessage: input.errorMessage,
    failedAt: input.failedAt,
    consumerGroup: input.consumerGroup,
  };
}

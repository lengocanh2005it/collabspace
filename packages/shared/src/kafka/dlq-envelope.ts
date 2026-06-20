export type DlqErrorCategory = 'transient' | 'logic' | 'schema' | 'unknown';

/** Dead-letter envelope published to `collabspace.dlq.events` when a consumer exhausts retries. */
export type KafkaDlqEnvelope = {
  version: 1;
  sourceTopic: string;
  partition: number;
  offset: string;
  key?: string;
  payload: unknown;
  errorMessage: string;
  errorCategory?: DlqErrorCategory;
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
  errorCategory?: DlqErrorCategory;
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
    errorCategory: input.errorCategory,
    failedAt: input.failedAt,
    consumerGroup: input.consumerGroup,
  };
}

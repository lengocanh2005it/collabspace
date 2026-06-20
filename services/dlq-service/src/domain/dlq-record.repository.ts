import type { DlqErrorCategory, DlqRecord, DlqStatus } from './dlq-record.schema';

export type ListDlqFilter = {
  status?: DlqStatus;
  errorCategory?: DlqErrorCategory;
  sourceTopic?: string;
  cursor?: string;
  limit: number;
};

export type ListDlqResult = {
  records: DlqRecord[];
  nextCursor: string | null;
  total: number;
};

export type CreateDlqRecordInput = {
  sourceTopic: string;
  sourcePartition: number;
  sourceOffset: string;
  sourceKey: string | null;
  consumerGroup: string | null;
  payload: Record<string, unknown>;
  errorMessage: string;
  errorCategory: DlqErrorCategory;
  failedAt: Date;
  status: DlqStatus;
  maxRetries: number;
  nextRetryAt: Date | null;
};

export const DLQ_RECORD_REPOSITORY = 'DLQ_RECORD_REPOSITORY';

export interface IDlqRecordRepository {
  list(filter: ListDlqFilter): Promise<ListDlqResult>;
  findById(id: string): Promise<DlqRecord | null>;
  upsertFromEnvelope(input: CreateDlqRecordInput): Promise<DlqRecord>;
}

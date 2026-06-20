import type {
  DlqErrorCategory,
  DlqRecord,
  DlqRetryHistoryEntry,
  DlqStatus,
} from './dlq-record.schema';

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

export type PostReplayUpdate = {
  by: string;
  action: DlqRetryHistoryEntry['action'];
  result: DlqRetryHistoryEntry['result'];
  errorMessage?: string;
  newRetryCount: number;
  nextStatus: DlqStatus;
  nextRetryAt: Date | null;
};

export type FindForReplayFilter = {
  statuses: DlqStatus[];
  sourceTopic?: string;
  errorCategory?: DlqErrorCategory;
  limit: number;
};

export const DLQ_RECORD_REPOSITORY = 'DLQ_RECORD_REPOSITORY';

export interface IDlqRecordRepository {
  // Read
  list(filter: ListDlqFilter): Promise<ListDlqResult>;
  findById(id: string): Promise<DlqRecord | null>;
  findForReplay(filter: FindForReplayFilter): Promise<DlqRecord[]>;

  // Write (ingest)
  upsertFromEnvelope(input: CreateDlqRecordInput): Promise<DlqRecord>;

  // Replay lifecycle (atomic)
  acquireLock(id: string, lockedBy: string): Promise<DlqRecord | null>;
  releaseAfterReplay(id: string, update: PostReplayUpdate): Promise<DlqRecord | null>;

  // Admin terminal actions
  updateStatusByAdmin(
    id: string,
    newStatus: 'resolved' | 'discarded',
    adminId: string,
    note: string,
  ): Promise<DlqRecord | null>;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  DlqErrorCategory,
  DlqRecord,
  DlqRetryHistoryEntry,
  DlqStatus,
} from '../../domain/dlq-record.schema';

export class DlqRetryHistoryEntryDto {
  @ApiProperty() at!: string;
  @ApiProperty() by!: string;
  @ApiProperty({ enum: ['auto_retry', 'manual_replay', 'resolve', 'discard'] })
  action!: DlqRetryHistoryEntry['action'];
  @ApiProperty({ enum: ['success', 'failure'] }) result!: DlqRetryHistoryEntry['result'];
  @ApiPropertyOptional() errorMessage?: string;
}

export class DlqMessageResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() sourceTopic!: string;
  @ApiProperty() sourcePartition!: number;
  @ApiProperty() sourceOffset!: string;
  @ApiPropertyOptional() sourceKey!: string | null;
  @ApiPropertyOptional() consumerGroup!: string | null;
  @ApiProperty() payload!: Record<string, unknown>;
  @ApiProperty() errorMessage!: string;
  @ApiProperty({ enum: ['transient', 'logic', 'schema', 'unknown'] })
  errorCategory!: DlqErrorCategory;
  @ApiProperty() failedAt!: string;
  @ApiProperty({
    enum: ['pending', 'replaying', 'requires_manual_review', 'resolved', 'discarded'],
  })
  status!: DlqStatus;
  @ApiProperty() retryCount!: number;
  @ApiProperty() maxRetries!: number;
  @ApiPropertyOptional() nextRetryAt!: string | null;
  @ApiPropertyOptional() lastRetriedAt!: string | null;
  @ApiPropertyOptional() replayedBy!: string | null;
  @ApiPropertyOptional() resolvedBy!: string | null;
  @ApiPropertyOptional() discardedBy!: string | null;
  @ApiPropertyOptional() resolutionNote!: string | null;
  @ApiProperty({ type: [DlqRetryHistoryEntryDto] }) retryHistory!: DlqRetryHistoryEntryDto[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromDocument(doc: DlqRecord & { _id: { toString(): string } }): DlqMessageResponseDto {
    return {
      id: doc._id.toString(),
      sourceTopic: doc.sourceTopic,
      sourcePartition: doc.sourcePartition,
      sourceOffset: doc.sourceOffset,
      sourceKey: doc.sourceKey,
      consumerGroup: doc.consumerGroup,
      payload: doc.payload,
      errorMessage: doc.errorMessage,
      errorCategory: doc.errorCategory,
      failedAt: doc.failedAt.toISOString(),
      status: doc.status,
      retryCount: doc.retryCount,
      maxRetries: doc.maxRetries,
      nextRetryAt: doc.nextRetryAt?.toISOString() ?? null,
      lastRetriedAt: doc.lastRetriedAt?.toISOString() ?? null,
      replayedBy: doc.replayedBy,
      resolvedBy: doc.resolvedBy,
      discardedBy: doc.discardedBy,
      resolutionNote: doc.resolutionNote,
      retryHistory: doc.retryHistory.map((h) => ({
        at: h.at.toISOString(),
        by: h.by,
        action: h.action,
        result: h.result,
        errorMessage: h.errorMessage,
      })),
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}

export class ListDlqMessagesResponseDto {
  @ApiProperty({ type: [DlqMessageResponseDto] }) data!: DlqMessageResponseDto[];
  @ApiPropertyOptional({ description: 'Pass as `cursor` param for next page; null = last page' })
  nextCursor!: string | null;
  @ApiProperty({ description: 'Total count matching filters (ignores cursor)' })
  total!: number;
}

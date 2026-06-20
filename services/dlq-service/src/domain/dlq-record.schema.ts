import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type DlqStatus =
  | 'pending'
  | 'replaying'
  | 'requires_manual_review'
  | 'resolved'
  | 'discarded';

export type DlqErrorCategory = 'transient' | 'logic' | 'schema' | 'unknown';

export type DlqRetryHistoryEntry = {
  at: Date;
  by: string;
  action: 'auto_retry' | 'manual_replay' | 'resolve' | 'discard';
  result: 'success' | 'failure';
  errorMessage?: string;
};

export type DlqRecordDocument = HydratedDocument<DlqRecord>;

@Schema({ collection: 'dlq_records', timestamps: true })
export class DlqRecord {
  // Origin
  @Prop({ type: String, required: true, index: true })
  sourceTopic!: string;

  @Prop({ type: Number, required: true })
  sourcePartition!: number;

  @Prop({ type: String, required: true })
  sourceOffset!: string;

  @Prop({ type: String, default: null })
  sourceKey!: string | null;

  @Prop({ type: String, default: null })
  consumerGroup!: string | null;

  // Payload & Error
  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({ type: String, required: true })
  errorMessage!: string;

  @Prop({
    type: String,
    required: true,
    enum: ['transient', 'logic', 'schema', 'unknown'] satisfies DlqErrorCategory[],
    default: 'unknown',
  })
  errorCategory!: DlqErrorCategory;

  @Prop({ type: Date, required: true })
  failedAt!: Date;

  // Lifecycle
  @Prop({
    type: String,
    required: true,
    enum: [
      'pending',
      'replaying',
      'requires_manual_review',
      'resolved',
      'discarded',
    ] satisfies DlqStatus[],
    default: 'pending',
    index: true,
  })
  status!: DlqStatus;

  @Prop({ type: Number, default: 0 })
  retryCount!: number;

  @Prop({ type: Number, required: true })
  maxRetries!: number;

  @Prop({ type: Date, default: null })
  nextRetryAt!: Date | null;

  @Prop({ type: Date, default: null })
  lastRetriedAt!: Date | null;

  // Audit
  @Prop({ type: String, default: null })
  replayedBy!: string | null;

  @Prop({ type: Array, default: [] })
  retryHistory!: DlqRetryHistoryEntry[];

  @Prop({ type: String, default: null })
  resolvedBy!: string | null;

  @Prop({ type: String, default: null })
  discardedBy!: string | null;

  @Prop({ type: String, default: null })
  resolutionNote!: string | null;

  // Lock
  @Prop({ type: Date, default: null })
  lockedAt!: Date | null;

  @Prop({ type: String, default: null })
  lockedBy!: string | null;

  @Prop({ type: Date })
  createdAt!: Date;

  @Prop({ type: Date })
  updatedAt!: Date;
}

export const DlqRecordSchema = SchemaFactory.createForClass(DlqRecord);

// Indexes
DlqRecordSchema.index({ status: 1, nextRetryAt: 1 });
DlqRecordSchema.index({ status: 1, errorCategory: 1 });
DlqRecordSchema.index({ sourceTopic: 1, status: 1 });
DlqRecordSchema.index({ createdAt: -1 });
DlqRecordSchema.index({ sourceTopic: 1, sourcePartition: 1, sourceOffset: 1 }, { unique: true });

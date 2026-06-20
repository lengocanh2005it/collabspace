import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { DlqRecord, type DlqRecordDocument } from '../../domain/dlq-record.schema';
import type {
  CreateDlqRecordInput,
  IDlqRecordRepository,
  ListDlqFilter,
  ListDlqResult,
} from '../../domain/dlq-record.repository';

@Injectable()
export class MongoDlqRecordRepository implements IDlqRecordRepository {
  constructor(
    @InjectModel(DlqRecord.name)
    private readonly model: Model<DlqRecordDocument>,
  ) {}

  async list(filter: ListDlqFilter): Promise<ListDlqResult> {
    const query: Record<string, unknown> = {};
    if (filter.status) query.status = filter.status;
    if (filter.errorCategory) query.errorCategory = filter.errorCategory;
    if (filter.sourceTopic) query.sourceTopic = filter.sourceTopic;

    const total = await this.model.countDocuments(query);

    const cursorQuery = { ...query };
    if (filter.cursor) {
      try {
        const decodedId = Buffer.from(filter.cursor, 'base64url').toString('utf8');
        cursorQuery._id = { $lt: decodedId };
      } catch {
        // invalid cursor — ignore, return from start
      }
    }

    const records = await this.model
      .find(cursorQuery)
      .sort({ _id: -1 })
      .limit(filter.limit + 1)
      .lean()
      .exec();

    let nextCursor: string | null = null;
    if (records.length > filter.limit) {
      records.pop();
      const lastId = String(records[records.length - 1]._id);
      nextCursor = Buffer.from(lastId, 'utf8').toString('base64url');
    }

    return {
      records: records as unknown as DlqRecord[],
      nextCursor,
      total,
    };
  }

  async findById(id: string): Promise<DlqRecord | null> {
    return this.model.findById(id).lean().exec() as Promise<DlqRecord | null>;
  }

  async upsertFromEnvelope(input: CreateDlqRecordInput): Promise<DlqRecord> {
    const filter = {
      sourceTopic: input.sourceTopic,
      sourcePartition: input.sourcePartition,
      sourceOffset: input.sourceOffset,
    };

    const setOnInsert = {
      sourceKey: input.sourceKey,
      consumerGroup: input.consumerGroup,
      payload: input.payload,
      errorMessage: input.errorMessage,
      errorCategory: input.errorCategory,
      failedAt: input.failedAt,
      status: input.status,
      retryCount: 0,
      maxRetries: input.maxRetries,
      nextRetryAt: input.nextRetryAt,
      lastRetriedAt: null,
      replayedBy: null,
      resolvedBy: null,
      discardedBy: null,
      resolutionNote: null,
      retryHistory: [],
      lockedAt: null,
      lockedBy: null,
    };

    const result = await this.model
      .findOneAndUpdate(filter, { $setOnInsert: setOnInsert }, { upsert: true, new: true })
      .lean()
      .exec();

    return result as unknown as DlqRecord;
  }
}

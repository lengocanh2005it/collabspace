import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { DlqRecord, type DlqRecordDocument } from '../../domain/dlq-record.schema';
import type {
  CreateDlqRecordInput,
  FindForReplayFilter,
  IDlqRecordRepository,
  ListDlqFilter,
  ListDlqResult,
  PostReplayUpdate,
} from '../../domain/dlq-record.repository';

@Injectable()
export class MongoDlqRecordRepository implements IDlqRecordRepository {
  constructor(
    @InjectModel(DlqRecord.name)
    private readonly model: Model<DlqRecordDocument>,
  ) {}

  async list(filter: ListDlqFilter): Promise<ListDlqResult> {
    const query: Record<string, unknown> = {};
    if (filter.statuses?.length) query.status = { $in: filter.statuses };
    if (filter.errorCategory) query.errorCategory = filter.errorCategory;
    if (filter.sourceTopic) query.sourceTopic = filter.sourceTopic;
    if (filter.from || filter.to) {
      query.createdAt = {
        ...(filter.from ? { $gte: filter.from } : {}),
        ...(filter.to ? { $lte: filter.to } : {}),
      };
    }

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
    if (!Types.ObjectId.isValid(id)) return null;
    return this.model.findById(id).lean().exec();
  }

  async findForReplay(filter: FindForReplayFilter): Promise<DlqRecord[]> {
    const query: Record<string, unknown> = {
      status: { $in: filter.statuses },
      lockedBy: null,
    };
    if (filter.ids?.length) {
      const ids = filter.ids.filter((id) => Types.ObjectId.isValid(id));
      if (!ids.length) return [];
      query._id = { $in: ids.map((id) => new Types.ObjectId(id)) };
    }
    if (filter.sourceTopic) query.sourceTopic = filter.sourceTopic;
    if (filter.errorCategory) query.errorCategory = filter.errorCategory;
    if (filter.nextRetryAtBefore) query.nextRetryAt = { $lte: filter.nextRetryAtBefore };

    return this.model.find(query).sort({ createdAt: 1 }).limit(filter.limit).lean().exec();
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
      lockedFromStatus: null,
    };

    const result = await this.model
      .findOneAndUpdate(filter, { $setOnInsert: setOnInsert }, { upsert: true, new: true })
      .lean()
      .exec();

    return result;
  }

  async acquireLock(id: string, lockedBy: string): Promise<DlqRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const now = new Date();
    return this.model
      .findOneAndUpdate(
        {
          _id: id,
          status: { $in: ['pending', 'requires_manual_review'] },
          lockedBy: null,
        },
        {
          $set: {
            lockedFromStatus: null,
            status: 'replaying',
            lockedAt: now,
            lockedBy,
          },
        },
        { new: true },
      )
      .lean()
      .exec();
  }

  async releaseAfterReplay(id: string, update: PostReplayUpdate): Promise<DlqRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const historyEntry = {
      at: new Date(),
      by: update.by,
      action: update.action,
      result: update.result,
      errorMessage: update.errorMessage,
    };

    return this.model
      .findOneAndUpdate(
        { _id: id },
        {
          $set: {
            status: update.nextStatus,
            retryCount: update.newRetryCount,
            lastRetriedAt: new Date(),
            nextRetryAt: update.nextRetryAt,
            replayedBy: update.by,
            lockedAt: null,
            lockedBy: null,
            lockedFromStatus: null,
          },
          $push: { retryHistory: historyEntry },
        },
        { new: true },
      )
      .lean()
      .exec();
  }

  async releaseStaleLocks(lockedBefore: Date): Promise<number> {
    const result = await this.model
      .updateMany(
        { status: 'replaying', lockedAt: { $lt: lockedBefore } },
        { $set: { status: 'pending', lockedAt: null, lockedBy: null } },
      )
      .exec();
    return result.modifiedCount;
  }

  async findOldestPending(): Promise<DlqRecord | null> {
    return this.model.findOne({ status: 'pending' }).sort({ createdAt: 1 }).lean().exec();
  }

  async updateStatusByAdmin(
    id: string,
    newStatus: 'resolved' | 'discarded',
    adminId: string,
    note?: string,
  ): Promise<DlqRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const historyEntry = {
      at: new Date(),
      by: adminId,
      action: newStatus === 'resolved' ? 'resolve' : 'discard',
      result: 'success',
    };

    const setFields: Record<string, unknown> = {
      status: newStatus,
      resolutionNote: note?.trim() || null,
    };
    if (newStatus === 'resolved') {
      setFields.resolvedBy = adminId;
    } else {
      setFields.discardedBy = adminId;
    }

    return this.model
      .findOneAndUpdate(
        { _id: id, status: { $ne: 'discarded' } },
        { $set: setFields, $push: { retryHistory: historyEntry } },
        { new: true },
      )
      .lean()
      .exec();
  }
}

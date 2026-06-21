import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import {
  PlatformSnapshot,
  type PlatformSnapshotDocument,
} from '../../domain/platform-snapshot.schema.js';
import {
  TimeseriesDaily,
  type TimeseriesDailyDocument,
  type TimeseriesMetric,
} from '../../domain/timeseries-daily.schema.js';
import {
  ProcessedAnalyticsEvent,
  type ProcessedAnalyticsEventDocument,
} from '../../domain/processed-analytics-event.schema.js';

const SNAPSHOT_ID = 'global';

@Injectable()
export class AnalyticsRepository {
  constructor(
    @InjectModel(PlatformSnapshot.name)
    private readonly snapshotModel: Model<PlatformSnapshotDocument>,
    @InjectModel(TimeseriesDaily.name)
    private readonly timeseriesModel: Model<TimeseriesDailyDocument>,
    @InjectModel(ProcessedAnalyticsEvent.name)
    private readonly processedEventModel: Model<ProcessedAnalyticsEventDocument>,
  ) {}

  async processEventOnce(
    eventId: string,
    eventType: string,
    topic: string,
    handler: () => Promise<void>,
  ): Promise<boolean> {
    try {
      await this.processedEventModel.create({
        _id: eventId,
        eventType,
        topic,
        processedAt: new Date(),
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        return false;
      }
      throw error;
    }

    try {
      await handler();
      return true;
    } catch (error) {
      await this.processedEventModel.deleteOne({ _id: eventId }).exec();
      throw error;
    }
  }

  async incrementSnapshot(dotPath: string, amount = 1): Promise<void> {
    await this.snapshotModel.findOneAndUpdate(
      { _id: SNAPSHOT_ID },
      { $inc: { [dotPath]: amount }, $set: { updatedAt: new Date() } },
      { upsert: true, new: true },
    );
  }

  async decrementSnapshot(dotPath: string, amount = 1): Promise<void> {
    await this.incrementSnapshot(dotPath, -amount);
  }

  async incrementTimeseries(date: string, metric: TimeseriesMetric, amount = 1): Promise<void> {
    await this.timeseriesModel.findOneAndUpdate(
      { date, metric },
      { $inc: { value: amount }, $set: { updatedAt: new Date() } },
      { upsert: true, new: true },
    );
  }

  async getSnapshot(): Promise<PlatformSnapshotDocument | null> {
    return this.snapshotModel.findById(SNAPSHOT_ID).exec();
  }

  async getTimeseries(
    metric: TimeseriesMetric,
    from: string,
    to: string,
  ): Promise<TimeseriesDailyDocument[]> {
    return this.timeseriesModel
      .find({ metric, date: { $gte: from, $lte: to } })
      .sort({ date: 1 })
      .exec();
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      Number((error as { code?: unknown }).code) === 11000
    );
  }
}

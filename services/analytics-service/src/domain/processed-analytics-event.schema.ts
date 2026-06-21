import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type ProcessedAnalyticsEventDocument = HydratedDocument<ProcessedAnalyticsEvent>;

@Schema({ collection: 'processed_analytics_events' })
export class ProcessedAnalyticsEvent {
  @Prop({ required: true, type: String })
  _id!: string;

  @Prop({ required: true, type: String })
  eventType!: string;

  @Prop({ required: true, type: String })
  topic!: string;

  @Prop({ required: true, type: Date, default: () => new Date() })
  processedAt!: Date;
}

export const ProcessedAnalyticsEventSchema = SchemaFactory.createForClass(ProcessedAnalyticsEvent);

// TTL 7 days — prevent unbounded collection growth; dedup window matches Kafka max redelivery window
ProcessedAnalyticsEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

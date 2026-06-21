import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type TimeseriesMetric =
  | 'users_registered'
  | 'workspaces_created'
  | 'tasks_created'
  | 'tasks_completed';

export type TimeseriesDailyDocument = HydratedDocument<TimeseriesDaily>;

@Schema({ collection: 'timeseries_daily' })
export class TimeseriesDaily {
  @Prop({ type: String, required: true })
  date!: string;

  @Prop({ type: String, required: true })
  metric!: TimeseriesMetric;

  @Prop({ type: Number, default: 0 })
  value!: number;

  @Prop({ type: Date, default: () => new Date() })
  updatedAt!: Date;
}

export const TimeseriesDailySchema = SchemaFactory.createForClass(TimeseriesDaily);

TimeseriesDailySchema.index({ date: 1, metric: 1 }, { unique: true });

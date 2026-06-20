import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export const TASK_OUTBOX_AGGREGATE_TYPE = "Task";
export const TASK_OUTBOX_EVENT_TASK_ASSIGNED = "task.task_assigned";
export const TASK_OUTBOX_EVENT_TASK_COMMENTED = "task.comment_created";
export const TASK_OUTBOX_EVENT_COMMENT_MENTIONED = "task.comment_mentioned";

export type TaskOutboxEventDocument = HydratedDocument<TaskOutboxEvent>;

@Schema({ collection: "task_outbox_events" })
export class TaskOutboxEvent {
  @Prop({ required: true, type: Number, default: 0 })
  attemptCount!: number;

  @Prop({ required: true, type: Date, default: () => new Date() })
  availableAt!: Date;

  @Prop({ type: Date, default: null })
  claimedAt!: Date | null;

  @Prop({ required: true, type: String, default: TASK_OUTBOX_AGGREGATE_TYPE })
  aggregateType!: string;

  @Prop({ required: true, type: String })
  aggregateId!: string;

  @Prop({ required: true, type: String })
  eventType!: string;

  @Prop({ type: Date, default: null })
  failedAt!: Date | null;

  @Prop({ type: String, default: null })
  lastError!: string | null;

  @Prop({ required: true, type: Object })
  payload!: Record<string, unknown>;

  @Prop({ type: Date, default: null })
  processedAt!: Date | null;
}

export const TaskOutboxEventSchema = SchemaFactory.createForClass(TaskOutboxEvent);

TaskOutboxEventSchema.index({ processedAt: 1, failedAt: 1, availableAt: 1 });
TaskOutboxEventSchema.index({
  processedAt: 1,
  failedAt: 1,
  claimedAt: 1,
  availableAt: 1,
});

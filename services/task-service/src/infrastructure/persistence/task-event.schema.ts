// src/infrastructure/persistence/task-event.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export type TaskEventDocument = HydratedDocument<TaskEventPersistence>;

@Schema({ collection: "task_events", timestamps: false })
export class TaskEventPersistence {
  @Prop({ required: true, type: String, index: true })
  streamId!: string;

  @Prop({ required: true, type: Number })
  version!: number;

  @Prop({ required: true, type: String, unique: true })
  eventId!: string;

  @Prop({ required: true, type: String })
  eventType!: string;

  @Prop({ required: true, type: Date })
  occurredAt!: Date;

  @Prop({ required: true, type: Object })
  payload!: Record<string, unknown>;
}

export const TaskEventSchema =
  SchemaFactory.createForClass(TaskEventPersistence);

TaskEventSchema.index({ streamId: 1, version: 1 }, { unique: true });

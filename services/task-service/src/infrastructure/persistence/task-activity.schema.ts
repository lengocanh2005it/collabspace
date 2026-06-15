// src/infrastructure/persistence/task-activity.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export type TaskActivityDocument = HydratedDocument<TaskActivityPersistence>;

@Schema({ collection: "task_activity", timestamps: false })
export class TaskActivityPersistence {
  @Prop({ required: true, type: String })
  _id!: string;

  @Prop({ required: true, type: String, index: true })
  taskId!: string;

  @Prop({ required: true, type: String })
  type!: string;

  @Prop({ type: String, default: null })
  actorId!: string | null;

  @Prop({ type: String, default: null })
  actorName!: string | null;

  @Prop({ type: String, default: null })
  actorAvatarUrl!: string | null;

  @Prop({ required: true, type: String })
  summary!: string;

  @Prop({ required: true, type: Object, default: {} })
  meta!: Record<string, unknown>;

  @Prop({ required: true, type: Date })
  occurredAt!: Date;
}

export const TaskActivitySchema = SchemaFactory.createForClass(TaskActivityPersistence);

TaskActivitySchema.index({ taskId: 1, occurredAt: 1 });

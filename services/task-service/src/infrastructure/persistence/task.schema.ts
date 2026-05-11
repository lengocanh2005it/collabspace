// src/infrastructure/persistence/task.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TaskDocument = Document;

@Schema({ timestamps: true, collection: 'tasks' })
export class TaskPersistence {
  @Prop({ required: true, type: String })
  _id!: string; // UUID của task

  @Prop({ required: true })
  title!: string;

  @Prop({ default: '' })
  description?: string;

  @Prop({ required: true, enum: ['TODO', 'DOING', 'DONE'] })
  status!: string;

  @Prop({ required: true })
  workspaceId!: string;

  @Prop({ type: String, default: null })
  assigneeId?: string | null; // ID của người được gán task

  @Prop({ type: Object, required: true })
  createdBy!: {
    userId: string;
    name: string;
    avatarUrl?: string;
  };

  @Prop({ type: Object, default: null })
  assignedTo?: {
    userId: string;
    name: string;
    avatarUrl?: string;
  } | null;

  @Prop({ type: [String], default: [] })
  attachments!: string[]; // Array of S3 file URLs

  @Prop({ type: Date, default: () => new Date() })
  createdAt!: Date;

  @Prop({ type: Date, default: () => new Date() })
  updatedAt!: Date;
}

export const TaskSchema = SchemaFactory.createForClass(TaskPersistence);
// src/infrastructure/persistence/task-comment.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type TaskCommentDocument = TaskComment & Document;

@Schema({ collection: "task_comments", timestamps: true })
export class TaskComment {
  @Prop({ type: String, required: true, index: true })
  taskId!: string; // UUID từ Task

  @Prop({ type: String, required: true })
  authorId!: string; // UUID hoặc ID từ User Service

  @Prop({ type: String, required: true })
  authorName!: string; // Tên người bình luận (snapshot)

  @Prop({ type: String, default: "" })
  authorAvatarUrl?: string; // Avatar URL (snapshot)

  @Prop({ type: String, required: true })
  content!: string; // Nội dung bình luận

  // Điểm cốt lõi của tính năng Reply (Adjacency List)
  @Prop({ type: String, default: null, index: true })
  parentId?: string | null; // ID của comment cha (nếu là reply)

  @Prop({ type: [String], default: [] })
  mentions!: string[]; // Danh sách ID người được mention

  @Prop({ type: Boolean, default: false })
  isEdited!: boolean; // Đánh dấu comment đã được edit

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null; // Soft delete timestamp

  @Prop({ type: Number, default: 0 })
  reactionCount!: number; // Số lượng reaction (like, love, etc)

  @Prop({ type: Date, default: () => new Date() })
  createdAt!: Date;

  @Prop({ type: Date, default: () => new Date() })
  updatedAt!: Date;
}

export const TaskCommentSchema = SchemaFactory.createForClass(TaskComment);

// Index gộp để tăng tốc độ query - lấy comment của 1 task theo thời gian
TaskCommentSchema.index({ taskId: 1, createdAt: 1 });

// Index riêng cho parentId để tìm reply nhanh chóng
TaskCommentSchema.index({ parentId: 1, createdAt: 1 });

// Index cho mention để có thể notify người bị mention
TaskCommentSchema.index({ mentions: 1 });

// Soft delete index
TaskCommentSchema.index({ taskId: 1, deletedAt: 1 });

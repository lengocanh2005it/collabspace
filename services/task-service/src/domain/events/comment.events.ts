// src/domain/events/comment.events.ts

// 1. Định nghĩa Routing Key (Tên sự kiện) để không bao giờ bị gõ sai chính tả
export const TASK_COMMENTED_EVENT = "comment_created";

// 2. Định nghĩa cấu trúc Hợp đồng (Payload)
export interface TaskCommentedEventPayload {
  taskId: string;
  taskTitle: string;

  recipientId: string; // ID của người nhận Noti (VD: Assignee của Task)

  actorId: string; // Người thực hiện hành động (Người comment)
  actorName: string;
  actorAvatarUrl?: string;

  commentId: string; // ID của comment vừa tạo
  commentPreview: string; // Trích xuất nội dung ngắn
  createdAt: string; // Thời gian tạo (ISO String)
}

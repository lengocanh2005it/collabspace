// src/domain/events/comment-events.ts

/**
 * Comment-related Event Payloads
 * Events triggered when comment operations occur
 */

// src/domain/events/comment.events.ts

// 1. Định nghĩa Routing Key (Tên sự kiện) để không bao giờ bị gõ sai chính tả
export const TASK_COMMENTED_EVENT = "task_commented";

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

export interface CommentRepliedEventPayload {
  commentId: string;
  parentCommentId: string;
  taskId: string;
  taskTitle: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  originalCommentAuthorId: string; // Notify tác giả comment gốc
  workspaceId: string;
}

export interface CommentMentionedEventPayload {
  commentId: string;
  taskId: string;
  taskTitle: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  mentionedUserIds: string[];
  content: string;
  workspaceId: string;
}

export interface CommentEditedEventPayload {
  commentId: string;
  taskId: string;
  taskTitle: string;
  authorId: string;
  authorName: string;
  newContent: string;
  oldContent: string;
  editedAt: Date;
  workspaceId: string;
}

export interface CommentDeletedEventPayload {
  commentId: string;
  taskId: string;
  taskTitle: string;
  authorId: string; // Original author
  deletedBy: string; // Who deleted it
  deletedByName: string;
  workspaceId: string;
}

export interface CommentReactionAddedEventPayload {
  commentId: string;
  taskId: string;
  taskTitle: string;
  authorId: string;
  authorName: string;
  reactionType: string; // 'like', 'love', 'thumbsup', etc.
  reactedBy: string;
  reactedByName: string;
  workspaceId: string;
}

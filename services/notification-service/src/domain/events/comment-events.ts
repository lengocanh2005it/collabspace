import { COMMENT_MENTIONED_EVENT, TASK_COMMENTED_EVENT } from "@collabspace/shared";

export { COMMENT_MENTIONED_EVENT, TASK_COMMENTED_EVENT };
export type {
  CommentMentionedEventPayload,
  EventEnvelopeFields,
  TaskCommentedEventPayload,
} from "@collabspace/shared";

// Alias kept for backward compatibility with existing imports
export type { CommentMentionedEventPayload as CommentMentionedNotificationPayload } from "@collabspace/shared";

// Notification-service-specific types (not cross-service contracts)
export interface CommentRepliedEventPayload {
  commentId: string;
  parentCommentId: string;
  taskId: string;
  taskTitle: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  originalCommentAuthorId: string;
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
  authorId: string;
  deletedBy: string;
  deletedByName: string;
  workspaceId: string;
}

export interface CommentReactionAddedEventPayload {
  commentId: string;
  taskId: string;
  taskTitle: string;
  authorId: string;
  authorName: string;
  reactionType: string;
  reactedBy: string;
  reactedByName: string;
  workspaceId: string;
}

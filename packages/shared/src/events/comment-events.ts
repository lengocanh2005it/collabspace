import type { EventEnvelopeFields } from './envelope';

export const TASK_COMMENTED_EVENT = 'comment_created';
export const COMMENT_MENTIONED_EVENT = 'comment_mentioned';

export interface TaskCommentedEventPayload extends EventEnvelopeFields {
  taskId: string;
  taskTitle: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl?: string;
  commentId: string;
  commentPreview: string;
  createdAt: string;
}

export interface CommentMentionedEventPayload extends EventEnvelopeFields {
  taskId: string;
  taskTitle: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl?: string;
  commentId: string;
  commentPreview: string;
  createdAt: string;
}

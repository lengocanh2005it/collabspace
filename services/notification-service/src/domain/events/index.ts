// src/domain/events/index.ts

/**
 * Central export point for all event definitions
 * Facilitates easy importing and maintains clear structure
 */

// Task events
export type {
  TaskAssignedEventPayload,
  //   TaskStatusChangedEventPayload,
  //   TaskDueDateApproachingEventPayload,
  //   TaskDeletedEventPayload,
  //   TaskCreatedEventPayload,
  //   TaskUpdatedEventPayload,
} from "./task-events";

// Comment events
export type {
  TaskCommentedEventPayload,
  CommentRepliedEventPayload,
  CommentMentionedNotificationPayload,
  CommentEditedEventPayload,
  CommentDeletedEventPayload,
  CommentReactionAddedEventPayload,
} from "./comment-events";

// Workspace events
export type {
  WorkspaceInvitedEventPayload,
  WorkspaceMemberJoinedEventPayload,
  WorkspaceMemberLeftEventPayload,
  WorkspaceMemberRoleChangedEventPayload,
  WorkspaceCreatedEventPayload,
  WorkspaceUpdatedEventPayload,
  WorkspaceDeletedEventPayload,
} from "./workspace-events";

// Attachment events
export type {
  AttachmentAddedEventPayload,
  AttachmentDeletedEventPayload,
  AttachmentDownloadedEventPayload,
} from "./attachment-events";

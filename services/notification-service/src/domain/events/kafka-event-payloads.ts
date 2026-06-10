// DEPRECATED: Use individual event files instead (task-events.ts, comment-events.ts, etc.)
// This file is kept for backward compatibility only

export type { TaskAssignedEventPayload } from "./task-events";
export type { TaskCommentedEventPayload } from "./comment-events";
export type { WorkspaceInvitedEventPayload } from "./workspace-events";
export type { AttachmentAddedEventPayload } from "./attachment-events";
export * from "./kafka-event-wrapper";

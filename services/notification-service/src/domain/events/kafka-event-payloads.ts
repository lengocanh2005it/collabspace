// src/domain/events/kafka-event-payloads.ts
// DEPRECATED: Use individual event files instead (task-events.ts, comment-events.ts, etc.)
// This file is kept for backward compatibility only

/**
 * @deprecated Use individual event files for imports:
 * - import { TaskAssignedEventPayload } from './task-events'
 * - import { CommentAddedEventPayload } from './comment-events'
 * - import { WorkspaceInvitedEventPayload } from './workspace-events'
 * - import { AttachmentAddedEventPayload } from './attachment-events'
 * - import { KafkaEventWrapper, KafkaEventType } from './kafka-event-wrapper'
 */

// Re-export everything for backward compatibility
export * from './task-events';
export * from './comment-events';
export * from './workspace-events';
export * from './attachment-events';
export * from './kafka-event-wrapper';

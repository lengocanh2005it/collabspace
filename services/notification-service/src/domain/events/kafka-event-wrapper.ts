// src/domain/events/kafka-event-wrapper.ts

/**
 * Generic Kafka Event Wrapper
 * Wraps all event payloads with metadata for traceability
 */

export interface KafkaEventWrapper<T = any> {
  eventId: string;           // Unique event ID (UUID)
  eventType: string;         // e.g., 'task.assigned', 'comment.added'
  timestamp: Date;           // When event occurred
  version: string;           // Event schema version (e.g., '1.0.0')
  source: string;            // Service that emitted (e.g., 'task-service')
  correlationId?: string;    // For tracing across services
  payload: T;                // Event-specific data
}

/**
 * Enum of all supported event types
 * Used for type-safe event routing
 */
export enum KafkaEventType {
  // Task events
  TASK_ASSIGNED = 'task.assigned',
  TASK_STATUS_CHANGED = 'task.status_changed',
  TASK_DUE_DATE_APPROACHING = 'task.due_date_approaching',
  TASK_DELETED = 'task.deleted',
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',

  // Comment events
  COMMENT_ADDED = 'comment.added',
  COMMENT_REPLIED = 'comment.replied',
  COMMENT_MENTIONED = 'comment.mentioned',
  COMMENT_EDITED = 'comment.edited',
  COMMENT_DELETED = 'comment.deleted',
  COMMENT_REACTION_ADDED = 'comment.reaction_added',

  // Attachment events
  ATTACHMENT_ADDED = 'attachment.added',
  ATTACHMENT_DELETED = 'attachment.deleted',
  ATTACHMENT_DOWNLOADED = 'attachment.downloaded',

  // Workspace events
  WORKSPACE_INVITED = 'workspace.invited',
  WORKSPACE_MEMBER_JOINED = 'workspace.member_joined',
  WORKSPACE_MEMBER_LEFT = 'workspace.member_left',
  WORKSPACE_MEMBER_ROLE_CHANGED = 'workspace.member_role_changed',
  WORKSPACE_CREATED = 'workspace.created',
  WORKSPACE_UPDATED = 'workspace.updated',
  WORKSPACE_DELETED = 'workspace.deleted',

  // System events
  SYSTEM_ALERT = 'system.alert',
}

/**
 * Helper function to create a properly formatted Kafka event wrapper
 */
export function createKafkaEventWrapper<T>(
  eventType: KafkaEventType,
  payload: T,
  source: string = 'unknown',
  version: string = '1.0.0',
  correlationId?: string,
): KafkaEventWrapper<T> {
  return {
    eventId: generateEventId(),
    eventType,
    timestamp: new Date(),
    version,
    source,
    correlationId,
    payload,
  };
}

/**
 * Generate a unique event ID (UUID v4)
 */
function generateEventId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

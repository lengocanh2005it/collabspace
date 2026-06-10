// src/domain/events/task-events.ts

/**
 * Task-related Event Payloads
 * Events triggered when task operations occur
 */

export const TASK_ASSIGNED_EVENT = "task_assigned";

export type EventEnvelopeFields = {
  eventId: string;
  occurredAt: string;
};

export type TaskAssignedEventPayload = EventEnvelopeFields & {
  taskId: string;
  recipientId: string; // User ID được giao việc
  actorId: string; // User ID người giao việc
  actorName: string;
  actorAvatarUrl?: string;
  taskTitle: string;
  assignedAt: string;
  workspaceId: string;
};

// export interface TaskStatusChangedEventPayload {
//   taskId: string;
//   taskTitle: string;
//   oldStatus: string;
//   newStatus: string;
//   changedBy: string;     // Người thay đổi
//   changedByName: string;
//   changedByAvatarUrl?: string;
//   assigneeId: string;    // Người được notify (người được gán task)
//   workspaceId: string;
// }

// export interface TaskDueDateApproachingEventPayload {
//   taskId: string;
//   taskTitle: string;
//   dueDate: Date;
//   assigneeId: string;
//   workspaceId: string;
// }

// export interface TaskDeletedEventPayload {
//   taskId: string;
//   taskTitle: string;
//   deletedBy: string;
//   deletedByName: string;
//   assigneeId: string;
//   workspaceId: string;
// }

// export interface TaskCreatedEventPayload {
//   taskId: string;
//   taskTitle: string;
//   description?: string;
//   createdBy: string;
//   createdByName: string;
//   workspaceId: string;
//   priority?: string;
// }

// export interface TaskUpdatedEventPayload {
//   taskId: string;
//   taskTitle: string;
//   updatedBy: string;
//   updatedByName: string;
//   changes: {
//     fieldName: string;
//     oldValue: any;
//     newValue: any;
//   }[];
//   workspaceId: string;
// }

// src/domain/events/task-domain.events.ts
import type { StatusEnum } from "../value-objects/TaskStatus";
import type { PriorityEnum } from "../value-objects/TaskPriority";

export interface TaskUserSnapshotEventPayload {
  userId: string;
  email: string;
  fullName: string;
  displayName: string;
  avatarUrl?: string | null;
}

export const TaskDomainEventType = {
  TaskCreated: "TaskCreated",
  TaskDetailsUpdated: "TaskDetailsUpdated",
  TaskStatusChanged: "TaskStatusChanged",
  TaskAssigneeChanged: "TaskAssigneeChanged",
  TaskAttachmentAdded: "TaskAttachmentAdded",
  TaskAttachmentRemoved: "TaskAttachmentRemoved",
  TaskDeleted: "TaskDeleted",
} as const;

export type TaskDomainEventTypeName =
  (typeof TaskDomainEventType)[keyof typeof TaskDomainEventType];

export interface TaskCreatedPayload {
  title: string;
  description: string;
  status: StatusEnum;
  workspaceId: string;
  projectId?: string | null;
  priority: PriorityEnum;
  dueDate?: string | null;
  labels: string[];
  createdBy: TaskUserSnapshotEventPayload;
  createdAt: string;
}

export interface TaskDetailsUpdatedPayload {
  title: string;
  description: string;
  priority?: PriorityEnum;
  dueDate?: string | null;
  labels?: string[];
}

export interface TaskStatusChangedPayload {
  status: StatusEnum;
  previousStatus: StatusEnum;
}

export interface TaskAssigneeChangedPayload {
  assigneeId: string | null;
  assignedTo: TaskUserSnapshotEventPayload | null;
}

export interface TaskAttachmentAddedPayload {
  fileUrl: string;
}

export interface TaskAttachmentRemovedPayload {
  fileUrl: string;
}

export interface TaskDeletedPayload {
  deletedAt: string;
}

export type TaskDomainEventPayload =
  | TaskCreatedPayload
  | TaskDetailsUpdatedPayload
  | TaskStatusChangedPayload
  | TaskAssigneeChangedPayload
  | TaskAttachmentAddedPayload
  | TaskAttachmentRemovedPayload
  | TaskDeletedPayload;

/** Event raised by the aggregate before persistence assigns stream version. */
export interface UncommittedTaskDomainEvent {
  eventId: string;
  eventType: TaskDomainEventTypeName;
  occurredAt: string;
  payload: TaskDomainEventPayload;
}

/** Event as stored in the event store (includes stream metadata). */
export interface StoredTaskDomainEvent extends UncommittedTaskDomainEvent {
  streamId: string;
  version: number;
}

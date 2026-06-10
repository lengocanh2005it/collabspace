// src/domain/events/task-domain.events.ts
import type { StatusEnum } from "../value-objects/TaskStatus";

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
  TaskDeleted: "TaskDeleted",
} as const;

export type TaskDomainEventTypeName =
  (typeof TaskDomainEventType)[keyof typeof TaskDomainEventType];

export interface TaskCreatedPayload {
  title: string;
  description: string;
  status: StatusEnum;
  workspaceId: string;
  createdBy: TaskUserSnapshotEventPayload;
  createdAt: string;
}

export interface TaskDetailsUpdatedPayload {
  title: string;
  description: string;
}

export interface TaskStatusChangedPayload {
  status: StatusEnum;
  previousStatus: StatusEnum;
}

export interface TaskAssigneeChangedPayload {
  assigneeId: string | null;
  assignedTo: TaskUserSnapshotEventPayload | null;
}

export interface TaskDeletedPayload {
  deletedAt: string;
}

export type TaskDomainEventPayload =
  | TaskCreatedPayload
  | TaskDetailsUpdatedPayload
  | TaskStatusChangedPayload
  | TaskAssigneeChangedPayload
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

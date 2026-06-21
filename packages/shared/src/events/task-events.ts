import type { EventEnvelopeFields } from './envelope';

export const TASK_ASSIGNED_EVENT = 'task_assigned';
export const TASK_CREATED_EVENT = 'task_created';
export const TASK_STATUS_CHANGED_EVENT = 'task_status_changed';
export const TASK_DELETED_EVENT = 'task_deleted';

export type TaskAssignedEventPayload = EventEnvelopeFields & {
  taskId: string;
  taskTitle: string;
  workspaceId: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl?: string;
  assignedAt: string;
};

export type TaskCreatedEventPayload = EventEnvelopeFields & {
  creatorId: string;
  projectId?: string | null;
  status: 'TODO' | 'DOING' | 'DONE';
  taskId: string;
  taskTitle: string;
  workspaceId: string;
};

export type TaskStatusChangedEventPayload = EventEnvelopeFields & {
  actorId?: string;
  newStatus: 'TODO' | 'DOING' | 'DONE';
  previousStatus: 'TODO' | 'DOING' | 'DONE';
  taskId: string;
  workspaceId: string;
};

export type TaskDeletedEventPayload = EventEnvelopeFields & {
  actorId: string;
  status: 'TODO' | 'DOING' | 'DONE';
  taskId: string;
  workspaceId: string;
};

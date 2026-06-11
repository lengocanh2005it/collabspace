import type { EventEnvelopeFields } from './envelope';

export const TASK_ASSIGNED_EVENT = 'task_assigned';

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

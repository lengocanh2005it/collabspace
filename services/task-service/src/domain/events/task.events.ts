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

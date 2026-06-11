// src/presentation/dtos/task-activity.response.ts

export type ActivityEventType =
  | "task_created"
  | "task_details_updated"
  | "task_status_changed"
  | "task_assignee_changed"
  | "task_attachment_added"
  | "task_attachment_removed"
  | "task_deleted"
  | "comment_added";

export interface TaskActivityItemData {
  id: string;
  type: ActivityEventType;
  actorId: string | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
  summary: string;
  meta: Record<string, unknown>;
  occurredAt: string;
}

export class TaskActivityResponse {
  public readonly items: TaskActivityItemData[];
  public readonly total: number;

  constructor(items: TaskActivityItemData[], total: number) {
    this.items = items;
    this.total = total;
  }
}

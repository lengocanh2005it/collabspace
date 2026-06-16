// src/presentation/dtos/task.response.ts
export interface TaskUserResponse {
  userId: string;
  email: string;
  fullName: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface TaskResponseData {
  id: string;
  title: string;
  description: string;
  status: string;
  workspaceId: string;
  projectId: string | null;
  priority: string;
  dueDate: Date | null;
  labels: string[];
  assigneeId: string | null;
  createdBy: TaskUserResponse;
  assignedTo: TaskUserResponse | null;
  attachments: string[];
  commentCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class TaskResponse implements TaskResponseData {
  public readonly id: string;
  public readonly title: string;
  public readonly description: string;
  public readonly status: string;
  public readonly workspaceId: string;
  public readonly projectId: string | null;
  public readonly priority: string;
  public readonly dueDate: Date | null;
  public readonly labels: string[];
  public readonly assigneeId: string | null;
  public readonly createdBy: TaskUserResponse;
  public readonly assignedTo: TaskUserResponse | null;
  public readonly attachments: string[];
  public readonly commentCount: number;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: TaskResponseData) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.status = data.status;
    this.workspaceId = data.workspaceId;
    this.projectId = data.projectId;
    this.priority = data.priority;
    this.dueDate = data.dueDate;
    this.labels = data.labels;
    this.assigneeId = data.assigneeId;
    this.createdBy = data.createdBy;
    this.assignedTo = data.assignedTo;
    this.attachments = data.attachments;
    this.commentCount = data.commentCount ?? 0;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}

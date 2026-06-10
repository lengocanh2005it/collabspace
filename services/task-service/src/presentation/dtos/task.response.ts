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
  assigneeId: string | null;
  createdBy: TaskUserResponse;
  assignedTo: TaskUserResponse | null;
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class TaskResponse implements TaskResponseData {
  public readonly id: string;
  public readonly title: string;
  public readonly description: string;
  public readonly status: string;
  public readonly workspaceId: string;
  public readonly assigneeId: string | null;
  public readonly createdBy: TaskUserResponse;
  public readonly assignedTo: TaskUserResponse | null;
  public readonly attachments: string[];
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: TaskResponseData) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.status = data.status;
    this.workspaceId = data.workspaceId;
    this.assigneeId = data.assigneeId;
    this.createdBy = data.createdBy;
    this.assignedTo = data.assignedTo;
    this.attachments = data.attachments;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}

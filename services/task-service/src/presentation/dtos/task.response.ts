// src/presentation/dtos/task.response.ts
export class TaskResponse {
  public readonly id: string;
  public readonly title: string;
  public readonly description: string;
  public readonly status: string;
  public readonly workspaceId: string;
  public readonly assigneeId: string | null;
  public readonly createdBy: {
    userId: string;
    name: string;
    avatarUrl?: string;
  };
  public readonly assignedTo: {
    userId: string;
    name: string;
    avatarUrl?: string;
  } | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: any) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.status = data.status;
    this.workspaceId = data.workspaceId;
    this.assigneeId = data.assigneeId;
    this.createdBy = data.createdBy;
    this.assignedTo = data.assignedTo;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}

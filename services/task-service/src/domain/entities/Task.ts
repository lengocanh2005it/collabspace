// src/domain/entities/Task.ts
import { TaskId } from '../value-objects/TaskId';
import { TaskStatus } from '../value-objects/TaskStatus';
import { UserSnapshot } from '../value-objects/UserSnapshot';
import { BusinessRuleException } from '../exceptions/BusinessRuleException';

export class Task {
  private constructor(
    private readonly id: TaskId,
    private title: string,
    private description: string,
    private status: TaskStatus,
    private readonly workspaceId: string,
    private assigneeId: string | null,
    private assignedTo: UserSnapshot | null,
    private readonly createdBy: UserSnapshot,
    private readonly createdAt: Date,
    private updatedAt: Date,
    private attachments: string[] = []
  ) {}

  public static create(
    id: TaskId,
    title: string,
    description: string,
    workspaceId: string,
    createdBy: UserSnapshot
  ): Task {
    if (!title) throw new BusinessRuleException('Title required');
    if (!workspaceId) throw new BusinessRuleException('Workspace ID required');
    
    return new Task(
      id,
      title,
      description,
      new TaskStatus('TODO'),
      workspaceId,
      null,
      null,
      createdBy,
      new Date(),
      new Date()
    );
  }

  public static restore(
    id: TaskId,
    title: string,
    description: string,
    statusRaw: string,
    workspaceId: string,
    assigneeId: string | null,
    assignedTo: UserSnapshot | null,
    createdBy: UserSnapshot,
    createdAt: Date,
    updatedAt: Date,
    attachments: string[] = []
  ): Task {
    const status = new TaskStatus(statusRaw);
    return new Task(
      id,
      title,
      description,
      status,
      workspaceId,
      assigneeId,
      assignedTo,
      createdBy,
      createdAt,
      updatedAt,
      attachments
    );
  }

  public changeStatus(newStatusRaw: string): void {
    const newStatus = new TaskStatus(newStatusRaw);
    if (!this.status.canTransitionTo(newStatus)) {
      throw new BusinessRuleException('Business Rule Violated: Cannot move from DONE to TODO');
    }
    this.status = newStatus;
    this.updatedAt = new Date();
  }

  public updateDetails(title: string, description: string): void {
    if (!title) throw new BusinessRuleException('Title cannot be empty');
    this.title = title;
    this.description = description;
    this.updatedAt = new Date();
  }

  public assignTo(assigneeId: string, assignedTo: UserSnapshot): void {
    if (!assigneeId) throw new BusinessRuleException('Assignee ID cannot be empty');
    this.assigneeId = assigneeId;
    this.assignedTo = assignedTo;
    this.updatedAt = new Date();
  }

  public unassign(): void {
    this.assigneeId = null;
    this.assignedTo = null;
    this.updatedAt = new Date();
  }

  public addAttachment(fileUrl: string): void {
    if (!fileUrl) throw new BusinessRuleException('File URL cannot be empty');
    if (this.attachments.includes(fileUrl)) {
      throw new BusinessRuleException('This attachment already exists');
    }
    this.attachments.push(fileUrl);
    this.updatedAt = new Date();
  }

  public removeAttachment(fileUrl: string): void {
    const index = this.attachments.indexOf(fileUrl);
    if (index === -1) throw new BusinessRuleException('Attachment not found');
    this.attachments.splice(index, 1);
    this.updatedAt = new Date();
  }

  // ========================================================
  // GETTERS
  // ========================================================
  public getId(): TaskId {
    return this.id;
  }

  public getTitle(): string {
    return this.title;
  }

  public getDescription(): string {
    return this.description;
  }

  public getStatus(): TaskStatus {
    return this.status;
  }

  public getWorkspaceId(): string {
    return this.workspaceId;
  }

  public getAssigneeId(): string | null {
    return this.assigneeId;
  }

  public getAssignedTo(): UserSnapshot | null {
    return this.assignedTo;
  }

  public getCreatedBy(): UserSnapshot {
    return this.createdBy;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }

  public getAttachments(): string[] {
    return [...this.attachments]; // Return copy to prevent external modification
  }
}
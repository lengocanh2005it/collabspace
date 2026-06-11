// src/domain/entities/Task.ts
import { randomUUID } from "crypto";
import { TaskId } from "../value-objects/TaskId";
import { TaskStatus } from "../value-objects/TaskStatus";
import { TaskPriority } from "../value-objects/TaskPriority";
import { UserSnapshot } from "../value-objects/UserSnapshot";
import { BusinessRuleException } from "../exceptions/BusinessRuleException";
import {
  TaskAssigneeChangedPayload,
  TaskAttachmentAddedPayload,
  TaskAttachmentRemovedPayload,
  TaskCreatedPayload,
  TaskDeletedPayload,
  TaskDetailsUpdatedPayload,
  TaskDomainEventType,
  TaskStatusChangedPayload,
  TaskUserSnapshotEventPayload,
  type StoredTaskDomainEvent,
  type UncommittedTaskDomainEvent,
} from "../events/task-domain.events";

export type TaskCreateOptions = {
  projectId?: string | null;
  priority?: string;
  dueDate?: Date | null;
  labels?: string[];
};

export type TaskDetailsUpdateOptions = {
  priority?: string;
  dueDate?: Date | null;
  labels?: string[];
};

export class Task {
  private version = 0;
  private uncommittedEvents: UncommittedTaskDomainEvent[] = [];

  private constructor(
    private id: TaskId,
    private title: string,
    private description: string,
    private status: TaskStatus,
    private workspaceId: string,
    private projectId: string | null,
    private priority: TaskPriority,
    private dueDate: Date | null,
    private labels: string[],
    private assigneeId: string | null,
    private assignedTo: UserSnapshot | null,
    private createdBy: UserSnapshot,
    private createdAt: Date,
    private updatedAt: Date,
    private attachments: string[] = [],
    private deleted = false,
  ) {}

  public static create(
    id: TaskId,
    title: string,
    description: string,
    workspaceId: string,
    createdBy: UserSnapshot,
    options: TaskCreateOptions = {},
  ): Task {
    if (!title) throw new BusinessRuleException("Title required");
    if (!workspaceId) throw new BusinessRuleException("Workspace ID required");

    const task = new Task(
      id,
      "",
      "",
      new TaskStatus("TODO"),
      workspaceId,
      options.projectId ?? null,
      new TaskPriority(options.priority ?? "MEDIUM"),
      options.dueDate ?? null,
      options.labels ? [...options.labels] : [],
      null,
      null,
      createdBy,
      new Date(),
      new Date(),
    );

    const createdAt = new Date().toISOString();
    task.raise(TaskDomainEventType.TaskCreated, {
      title,
      description,
      status: "TODO",
      workspaceId,
      projectId: options.projectId ?? null,
      priority: task.priority.getValue(),
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      labels: [...task.labels],
      createdBy: task.toSnapshotPayload(createdBy),
      createdAt,
    } satisfies TaskCreatedPayload);

    return task;
  }

  public static fromHistory(events: StoredTaskDomainEvent[]): Task {
    if (events.length === 0) {
      throw new BusinessRuleException(
        "Cannot rehydrate task from empty event stream",
      );
    }

    const task = Task.emptyShell();
    for (const event of events) {
      task.applyStoredEvent(event);
    }
    return task;
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
    attachments: string[] = [],
    version = 0,
    projectId: string | null = null,
    priorityRaw = "MEDIUM",
    dueDate: Date | null = null,
    labels: string[] = [],
  ): Task {
    const status = new TaskStatus(statusRaw);
    const task = new Task(
      id,
      title,
      description,
      status,
      workspaceId,
      projectId,
      new TaskPriority(priorityRaw),
      dueDate,
      [...labels],
      assigneeId,
      assignedTo,
      createdBy,
      createdAt,
      updatedAt,
      attachments,
    );
    task.version = version;
    return task;
  }

  private static emptyShell(): Task {
    return new Task(
      new TaskId("00000000-0000-0000-0000-000000000000"),
      "",
      "",
      new TaskStatus("TODO"),
      "",
      null,
      new TaskPriority("MEDIUM"),
      null,
      [],
      null,
      null,
      UserSnapshot.create("legacy", "legacy@local", "Legacy", "Legacy", null),
      new Date(0),
      new Date(0),
    );
  }

  public changeStatus(newStatusRaw: string): void {
    const newStatus = new TaskStatus(newStatusRaw);
    if (!this.status.canTransitionTo(newStatus)) {
      throw new BusinessRuleException(
        "Business Rule Violated: Cannot move from DONE to TODO",
      );
    }

    const previousStatus = this.status.getValue();
    if (previousStatus === newStatus.getValue()) {
      return;
    }

    this.raise(TaskDomainEventType.TaskStatusChanged, {
      status: newStatus.getValue(),
      previousStatus,
    } satisfies TaskStatusChangedPayload);
  }

  public updateDetails(
    title: string,
    description: string,
    options: TaskDetailsUpdateOptions = {},
  ): void {
    if (!title) throw new BusinessRuleException("Title cannot be empty");

    const nextPriority = options.priority
      ? new TaskPriority(options.priority).getValue()
      : this.priority.getValue();
    const nextDueDate =
      options.dueDate !== undefined ? options.dueDate : this.dueDate;
    const nextLabels =
      options.labels !== undefined ? [...options.labels] : [...this.labels];

    if (
      this.title === title &&
      this.description === description &&
      this.priority.getValue() === nextPriority &&
      (this.dueDate?.toISOString() ?? null) ===
        (nextDueDate?.toISOString() ?? null) &&
      JSON.stringify(this.labels) === JSON.stringify(nextLabels)
    ) {
      return;
    }

    this.raise(TaskDomainEventType.TaskDetailsUpdated, {
      title,
      description,
      priority: nextPriority,
      dueDate: nextDueDate ? nextDueDate.toISOString() : null,
      labels: nextLabels,
    } satisfies TaskDetailsUpdatedPayload);
  }

  public assignTo(assigneeId: string, assignedTo: UserSnapshot): void {
    if (!assigneeId)
      throw new BusinessRuleException("Assignee ID cannot be empty");

    this.raise(TaskDomainEventType.TaskAssigneeChanged, {
      assigneeId,
      assignedTo: this.toSnapshotPayload(assignedTo),
    } satisfies TaskAssigneeChangedPayload);
  }

  public unassign(): void {
    if (!this.assigneeId) {
      return;
    }

    this.raise(TaskDomainEventType.TaskAssigneeChanged, {
      assigneeId: null,
      assignedTo: null,
    } satisfies TaskAssigneeChangedPayload);
  }

  public delete(): void {
    if (this.deleted) {
      return;
    }

    this.raise(TaskDomainEventType.TaskDeleted, {
      deletedAt: new Date().toISOString(),
    } satisfies TaskDeletedPayload);
  }

  public addAttachment(fileUrl: string): void {
    if (!fileUrl) throw new BusinessRuleException("File URL cannot be empty");
    if (this.attachments.includes(fileUrl)) {
      throw new BusinessRuleException("This attachment already exists");
    }

    this.raise(TaskDomainEventType.TaskAttachmentAdded, {
      fileUrl,
    } satisfies TaskAttachmentAddedPayload);
  }

  public removeAttachment(fileUrl: string): void {
    if (!this.attachments.includes(fileUrl)) {
      throw new BusinessRuleException("Attachment not found");
    }

    this.raise(TaskDomainEventType.TaskAttachmentRemoved, {
      fileUrl,
    } satisfies TaskAttachmentRemovedPayload);
  }

  public getUncommittedEvents(): ReadonlyArray<UncommittedTaskDomainEvent> {
    return this.uncommittedEvents;
  }

  public clearUncommittedEvents(): void {
    this.uncommittedEvents = [];
  }

  public getVersion(): number {
    return this.version;
  }

  public setVersion(version: number): void {
    this.version = version;
  }

  public isDeleted(): boolean {
    return this.deleted;
  }

  private raise(
    eventType: UncommittedTaskDomainEvent["eventType"],
    payload: UncommittedTaskDomainEvent["payload"],
  ): void {
    const event: UncommittedTaskDomainEvent = {
      eventId: randomUUID(),
      eventType,
      occurredAt: new Date().toISOString(),
      payload,
    };

    this.applyUncommittedEvent(event);
    this.uncommittedEvents.push(event);
  }

  private applyStoredEvent(event: StoredTaskDomainEvent): void {
    this.id = new TaskId(event.streamId);
    this.applyUncommittedEvent(event);
    this.version = event.version;
  }

  private applyUncommittedEvent(event: UncommittedTaskDomainEvent): void {
    switch (event.eventType) {
      case TaskDomainEventType.TaskCreated: {
        const payload = event.payload as TaskCreatedPayload;
        this.title = payload.title;
        this.description = payload.description;
        this.status = new TaskStatus(payload.status);
        this.workspaceId = payload.workspaceId;
        this.projectId = payload.projectId ?? null;
        this.priority = new TaskPriority(payload.priority ?? "MEDIUM");
        this.dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
        this.labels = [...(payload.labels ?? [])];
        this.assigneeId = null;
        this.assignedTo = null;
        this.createdBy = this.fromSnapshotPayload(payload.createdBy);
        this.createdAt = new Date(payload.createdAt);
        this.updatedAt = new Date(payload.createdAt);
        this.deleted = false;
        break;
      }
      case TaskDomainEventType.TaskDetailsUpdated: {
        const payload = event.payload as TaskDetailsUpdatedPayload;
        this.title = payload.title;
        this.description = payload.description;
        if (payload.priority) {
          this.priority = new TaskPriority(payload.priority);
        }
        if (payload.dueDate !== undefined) {
          this.dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
        }
        if (payload.labels !== undefined) {
          this.labels = [...payload.labels];
        }
        this.updatedAt = new Date(event.occurredAt);
        break;
      }
      case TaskDomainEventType.TaskStatusChanged: {
        const payload = event.payload as TaskStatusChangedPayload;
        this.status = new TaskStatus(payload.status);
        this.updatedAt = new Date(event.occurredAt);
        break;
      }
      case TaskDomainEventType.TaskAssigneeChanged: {
        const payload = event.payload as TaskAssigneeChangedPayload;
        this.assigneeId = payload.assigneeId;
        this.assignedTo = payload.assignedTo
          ? this.fromSnapshotPayload(payload.assignedTo)
          : null;
        this.updatedAt = new Date(event.occurredAt);
        break;
      }
      case TaskDomainEventType.TaskAttachmentAdded: {
        const payload = event.payload as TaskAttachmentAddedPayload;
        if (!this.attachments.includes(payload.fileUrl)) {
          this.attachments.push(payload.fileUrl);
        }
        this.updatedAt = new Date(event.occurredAt);
        break;
      }
      case TaskDomainEventType.TaskAttachmentRemoved: {
        const payload = event.payload as TaskAttachmentRemovedPayload;
        this.attachments = this.attachments.filter(
          (url) => url !== payload.fileUrl,
        );
        this.updatedAt = new Date(event.occurredAt);
        break;
      }
      case TaskDomainEventType.TaskDeleted: {
        this.deleted = true;
        this.updatedAt = new Date(event.occurredAt);
        break;
      }
      default:
        throw new BusinessRuleException(
          `Unknown task event type: ${event.eventType}`,
        );
    }
  }

  private toSnapshotPayload(
    snapshot: UserSnapshot,
  ): TaskUserSnapshotEventPayload {
    return snapshot.toPlainObject() as TaskUserSnapshotEventPayload;
  }

  private fromSnapshotPayload(
    payload: TaskUserSnapshotEventPayload,
  ): UserSnapshot {
    return UserSnapshot.create(
      payload.userId,
      payload.email,
      payload.fullName,
      payload.displayName,
      payload.avatarUrl,
    );
  }

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

  public getProjectId(): string | null {
    return this.projectId;
  }

  public getPriority(): TaskPriority {
    return this.priority;
  }

  public getDueDate(): Date | null {
    return this.dueDate;
  }

  public getLabels(): string[] {
    return [...this.labels];
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
    return [...this.attachments];
  }
}

// src/domain/entities/Task.ts
import { randomUUID } from "crypto";
import { TaskId } from "../value-objects/TaskId";
import { TaskStatus } from "../value-objects/TaskStatus";
import { UserSnapshot } from "../value-objects/UserSnapshot";
import { BusinessRuleException } from "../exceptions/BusinessRuleException";
import {
  TaskAssigneeChangedPayload,
  TaskCreatedPayload,
  TaskDeletedPayload,
  TaskDetailsUpdatedPayload,
  TaskDomainEventType,
  TaskStatusChangedPayload,
  TaskUserSnapshotEventPayload,
  type StoredTaskDomainEvent,
  type UncommittedTaskDomainEvent,
} from "../events/task-domain.events";

export class Task {
  private version = 0;
  private uncommittedEvents: UncommittedTaskDomainEvent[] = [];

  private constructor(
    private id: TaskId,
    private title: string,
    private description: string,
    private status: TaskStatus,
    private workspaceId: string,
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
  ): Task {
    if (!title) throw new BusinessRuleException("Title required");
    if (!workspaceId) throw new BusinessRuleException("Workspace ID required");

    const task = new Task(
      id,
      "",
      "",
      new TaskStatus("TODO"),
      workspaceId,
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
      createdBy: task.toSnapshotPayload(createdBy),
      createdAt,
    } satisfies TaskCreatedPayload);

    return task;
  }

  public static fromHistory(events: StoredTaskDomainEvent[]): Task {
    if (events.length === 0) {
      throw new BusinessRuleException("Cannot rehydrate task from empty event stream");
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
  ): Task {
    const status = new TaskStatus(statusRaw);
    const task = new Task(
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
      null,
      UserSnapshot.create(
        "legacy",
        "legacy@local",
        "Legacy",
        "Legacy",
        null,
      ),
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

  public updateDetails(title: string, description: string): void {
    if (!title) throw new BusinessRuleException("Title cannot be empty");
    if (this.title === title && this.description === description) {
      return;
    }

    this.raise(TaskDomainEventType.TaskDetailsUpdated, {
      title,
      description,
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
    this.attachments.push(fileUrl);
    this.updatedAt = new Date();
  }

  public removeAttachment(fileUrl: string): void {
    const index = this.attachments.indexOf(fileUrl);
    if (index === -1) throw new BusinessRuleException("Attachment not found");
    this.attachments.splice(index, 1);
    this.updatedAt = new Date();
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

  public mergeAttachmentsFromProjection(attachments: string[]): void {
    this.attachments = [...attachments];
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
      case TaskDomainEventType.TaskDeleted: {
        this.deleted = true;
        this.updatedAt = new Date(event.occurredAt);
        break;
      }
      default:
        throw new BusinessRuleException(`Unknown task event type: ${event.eventType}`);
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

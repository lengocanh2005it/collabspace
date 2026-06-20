// src/application/ports/ITaskRepository.ts
import type { Task } from "../../domain/entities/Task";
import type { TaskId } from "../../domain/value-objects/TaskId";
import type { TaskListFilter, TaskListOptions } from "./task-list-filter";
import type { MongoSessionOptions } from "./mongo-session-options";

export const ITaskRepository = Symbol("ITaskRepository"); // Token cho Dependency Injection

export interface ITaskRepository {
  /** Persist uncommitted domain events and refresh the read projection. */
  saveAsync(task: Task, options?: MongoSessionOptions): Promise<void>;
  /** Read model lookup (Mongo projection). */
  findByIdAsync(id: TaskId): Promise<Task | null>;
  /** Command-side aggregate load (event replay with legacy projection fallback). */
  loadAggregateByIdAsync(id: TaskId): Promise<Task | null>;
  findByWorkspaceIdAsync(
    workspaceId: string,
    filter?: TaskListFilter,
    options?: TaskListOptions,
  ): Promise<Task[]>;
  countByWorkspaceIdAsync(workspaceId: string, filter?: TaskListFilter): Promise<number>;
  countByWorkspaceGrouped(): Promise<Record<string, number>>;
  countByStatusGrouped(): Promise<Record<string, number>>;
  deleteAsync(id: TaskId): Promise<void>;
  addAttachmentAsync(taskId: TaskId, fileUrl: string): Promise<void>;
  removeAttachmentAsync(taskId: TaskId, fileUrl: string): Promise<void>;
}

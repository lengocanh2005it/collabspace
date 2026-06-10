// src/application/ports/ITaskRepository.ts
import { Task } from "../../domain/entities/Task";
import { TaskId } from "../../domain/value-objects/TaskId";

export const ITaskRepository = Symbol("ITaskRepository"); // Token cho Dependency Injection

export interface ITaskRepository {
  /** Persist uncommitted domain events and refresh the read projection. */
  saveAsync(task: Task): Promise<void>;
  /** Read model lookup (Mongo projection). */
  findByIdAsync(id: TaskId): Promise<Task | null>;
  /** Command-side aggregate load (event replay with legacy projection fallback). */
  loadAggregateByIdAsync(id: TaskId): Promise<Task | null>;
  findByWorkspaceIdAsync(workspaceId: string): Promise<Task[]>;
  deleteAsync(id: TaskId): Promise<void>;
  addAttachmentAsync(taskId: TaskId, fileUrl: string): Promise<void>;
  removeAttachmentAsync(taskId: TaskId, fileUrl: string): Promise<void>;
}

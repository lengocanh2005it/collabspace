// src/application/ports/ITaskRepository.ts
import { Task } from "../../domain/entities/Task";
import { TaskId } from "../../domain/value-objects/TaskId";

export const ITaskRepository = Symbol("ITaskRepository"); // Token cho Dependency Injection

export interface ITaskRepository {
  addAsync(task: Task): Promise<void>;
  findByIdAsync(id: TaskId): Promise<Task | null>;
  findByWorkspaceIdAsync(workspaceId: string): Promise<Task[]>;
  updateAsync(task: Task): Promise<void>;
  deleteAsync(id: TaskId): Promise<void>;
  addAttachmentAsync(taskId: TaskId, fileUrl: string): Promise<void>;
  removeAttachmentAsync(taskId: TaskId, fileUrl: string): Promise<void>;
}

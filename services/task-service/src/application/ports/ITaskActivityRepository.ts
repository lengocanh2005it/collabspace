// src/application/ports/ITaskActivityRepository.ts
import type { Comment } from "../../domain/entities/comment.entity";
import type { StoredTaskDomainEvent } from "../../domain/events/task-domain.events";
import type { TaskActivityItemData } from "../../presentation/dtos/task-activity.response";

export const ITaskActivityRepository = Symbol("ITaskActivityRepository");

export type TaskActivityListOptions = {
  offset: number;
  limit: number;
};

export interface ITaskActivityRepository {
  appendFromEventsAsync(
    taskId: string,
    events: StoredTaskDomainEvent[],
  ): Promise<void>;
  appendFromCommentAsync(comment: Comment): Promise<void>;
  findByTaskIdAsync(
    taskId: string,
    options: TaskActivityListOptions,
  ): Promise<TaskActivityItemData[]>;
  countByTaskIdAsync(taskId: string): Promise<number>;
}

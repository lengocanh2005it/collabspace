// src/application/usecases/get-tasks.handler.ts
import { QueryHandler, IQueryHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { GetTasksQuery } from "../queries/get-tasks.query";
import { ITaskRepository as ITaskRepositoryToken } from "../ports/ITaskRepository";
import type { ITaskRepository } from "../ports/ITaskRepository";
import {
  buildTaskListFilter,
  clampTaskListLimit,
} from "../ports/task-list-filter";
import { TaskMapper } from "../../infrastructure/mappers/task.mapper";
import type { TaskResponseData } from "../../presentation/dtos/task.response";

export interface GetTasksResult {
  tasks: TaskResponseData[];
  total: number;
  skip: number;
  limit: number;
}

@QueryHandler(GetTasksQuery)
export class GetTasksHandler implements IQueryHandler<GetTasksQuery> {
  constructor(
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(query: GetTasksQuery): Promise<GetTasksResult> {
    const filter = buildTaskListFilter({
      status: query.status,
      assigneeId: query.assigneeId,
      priority: query.priority?.toUpperCase(),
      projectId: query.projectId,
    });
    const skip = query.skip ?? 0;
    const limit = clampTaskListLimit(query.limit);

    const [tasks, total] = await Promise.all([
      this.taskRepository.findByWorkspaceIdAsync(query.workspaceId, filter, {
        skip,
        limit,
      }),
      this.taskRepository.countByWorkspaceIdAsync(query.workspaceId, filter),
    ]);

    return {
      tasks: tasks.map((task) => TaskMapper.toResponse(task)),
      total,
      skip,
      limit,
    };
  }
}

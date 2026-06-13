// src/application/usecases/get-tasks.handler.ts
import { QueryHandler, IQueryHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { GetTasksQuery } from "../queries/get-tasks.query";
import { ITaskRepository as ITaskRepositoryToken } from "../ports/ITaskRepository";
import type { ITaskRepository } from "../ports/ITaskRepository";
import { TaskMapper } from "../../infrastructure/mappers/task.mapper";
import type { TaskResponseData } from "../../presentation/dtos/task.response";

interface GetTasksResult {
  tasks: TaskResponseData[];
  total: number;
}

@QueryHandler(GetTasksQuery)
export class GetTasksHandler implements IQueryHandler<GetTasksQuery> {
  constructor(
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(query: GetTasksQuery): Promise<GetTasksResult> {
    let tasks = await this.taskRepository.findByWorkspaceIdAsync(
      query.workspaceId,
    );

    // Filter by status if provided
    if (query.status) {
      tasks = tasks.filter(
        (task) => task.getStatus().getValue() === query.status,
      );
    }

    // Filter by projectId if provided
    if (query.projectId) {
      tasks = tasks.filter((task) => task.getProjectId() === query.projectId);
    }

    // Filter by assigneeId if provided
    if (query.assigneeId) {
      tasks = tasks.filter((task) => task.getAssigneeId() === query.assigneeId);
    }

    if (query.priority) {
      const priority = query.priority.toUpperCase();
      tasks = tasks.filter(
        (task) => task.getPriority().getValue() === priority,
      );
    }


    const responses = tasks.map((task) => TaskMapper.toResponse(task));

    return {
      tasks: responses,
      total: responses.length,
    };
  }
}

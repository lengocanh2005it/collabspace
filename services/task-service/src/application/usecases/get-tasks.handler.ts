// src/application/usecases/get-tasks.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTasksQuery } from '../queries/get-tasks.query';
import { ITaskRepository } from '../ports/ITaskRepository';
import { TaskMapper } from '../../infrastructure/mappers/task.mapper';

@QueryHandler(GetTasksQuery)
export class GetTasksHandler implements IQueryHandler<GetTasksQuery> {
  constructor(
    @Inject(ITaskRepository)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(query: GetTasksQuery): Promise<any> {
    let tasks = await this.taskRepository.findByWorkspaceIdAsync(query.workspaceId);

    // Filter by status if provided
    if (query.status) {
      tasks = tasks.filter(task => task.getStatus().getValue() === query.status);
    }

    // Filter by assigneeId if provided
    if (query.assigneeId) {
      tasks = tasks.filter(task => task.getAssigneeId() === query.assigneeId);
    }

    const responses = tasks.map(task => TaskMapper.toResponse(task));

    return {
      tasks: responses,
      total: responses.length,
    };
  }
}

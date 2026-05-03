// src/application/queries/get-task-by-id.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTaskByIdQuery } from './get-task-by-id.query';
import { ITaskRepository } from '../ports/ITaskRepository';
import { TaskId } from '../../domain/value-objects/TaskId';
import { TaskMapper } from '../../infrastructure/mappers/task.mapper';
import { EntityNotFoundException } from '../../domain/exceptions/EntityNotFoundException';

@QueryHandler(GetTaskByIdQuery)
export class GetTaskByIdHandler implements IQueryHandler<GetTaskByIdQuery> {
  constructor(
    @Inject(ITaskRepository)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(query: GetTaskByIdQuery): Promise<any> {
    const taskId = new TaskId(query.taskId);
    const task = await this.taskRepository.findByIdAsync(taskId);

    if (!task) {
      throw new EntityNotFoundException('Task', query.taskId);
    }

    return TaskMapper.toResponse(task);
  }
}

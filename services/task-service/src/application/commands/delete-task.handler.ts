// src/application/commands/delete-task.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteTaskCommand } from './delete-task.command';
import { ITaskRepository } from '../ports/ITaskRepository';
import { TaskId } from '../../domain/value-objects/TaskId';

@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<DeleteTaskCommand, void> {
  constructor(
    @Inject(ITaskRepository)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(command: DeleteTaskCommand): Promise<void> {
    const taskId = new TaskId(command.taskId);
    await this.taskRepository.deleteAsync(taskId);
  }
}

// src/application/usecases/change-task-status.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ChangeTaskStatusCommand } from '../commands/change-task-status.command';
import { ITaskRepository } from '../ports/ITaskRepository';
import { TaskId } from '../../domain/value-objects/TaskId';
import { EntityNotFoundException } from '../../domain/exceptions/EntityNotFoundException';

@CommandHandler(ChangeTaskStatusCommand)
export class ChangeTaskStatusHandler implements ICommandHandler<ChangeTaskStatusCommand, void> {
  constructor(
    @Inject(ITaskRepository)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(command: ChangeTaskStatusCommand): Promise<void> {
    const taskId = new TaskId(command.taskId);
    const task = await this.taskRepository.findByIdAsync(taskId);

    if (!task) {
      throw new EntityNotFoundException('Task', command.taskId);
    }

    task.changeStatus(command.newStatus);
    await this.taskRepository.updateAsync(task);
  }
}

// src/application/commands/create-task.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateTaskCommand } from '../commands/create-task.command';
import { Task } from '../../domain/entities/Task';
import { TaskId } from '../../domain/value-objects/TaskId';
import { UserSnapshot } from '../../domain/value-objects/UserSnapshot';
import { ITaskRepository } from '../ports/ITaskRepository';

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand, string> {
  constructor(
    @Inject(ITaskRepository)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(command: CreateTaskCommand): Promise<string> {
    const taskId = TaskId.create();
    const creator = UserSnapshot.create(command.creatorId, command.creatorName);

    const newTask = Task.create(
      taskId,
      command.title,
      command.description,
      command.workspaceId,
      creator
    );

    await this.taskRepository.addAsync(newTask);

    return taskId.getValue();
  }
}
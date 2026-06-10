// src/application/usecases/update-task-details.handler.ts
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { UpdateTaskDetailsCommand } from "../commands/update-task-details.command";
import { ITaskRepository as ITaskRepositoryToken } from "../ports/ITaskRepository";
import type { ITaskRepository } from "../ports/ITaskRepository";
import { TaskId } from "../../domain/value-objects/TaskId";
import { EntityNotFoundException } from "../../domain/exceptions/EntityNotFoundException";

@CommandHandler(UpdateTaskDetailsCommand)
export class UpdateTaskDetailsHandler implements ICommandHandler<
  UpdateTaskDetailsCommand,
  void
> {
  constructor(
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(command: UpdateTaskDetailsCommand): Promise<void> {
    const taskId = new TaskId(command.taskId);
    const task = await this.taskRepository.findByIdAsync(taskId);

    if (!task) {
      throw new EntityNotFoundException("Task", command.taskId);
    }

    task.updateDetails(command.title, command.description);
    await this.taskRepository.updateAsync(task);
  }
}

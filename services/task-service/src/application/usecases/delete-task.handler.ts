// src/application/usecases/delete-task.handler.ts
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { DeleteTaskCommand } from "../commands/delete-task.command";
import { ITaskRepository as ITaskRepositoryToken } from "../ports/ITaskRepository";
import type { ITaskRepository } from "../ports/ITaskRepository";
import { TaskId } from "../../domain/value-objects/TaskId";

@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<
  DeleteTaskCommand,
  void
> {
  constructor(
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(command: DeleteTaskCommand): Promise<void> {
    const taskId = new TaskId(command.taskId);
    await this.taskRepository.deleteAsync(taskId);
  }
}

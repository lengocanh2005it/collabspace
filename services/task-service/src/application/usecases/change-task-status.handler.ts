// src/application/usecases/change-task-status.handler.ts
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ChangeTaskStatusCommand } from "../commands/change-task-status.command";
import { ITaskRepository as ITaskRepositoryToken } from "../ports/ITaskRepository";
import type { ITaskRepository } from "../ports/ITaskRepository";
import { TaskId } from "../../domain/value-objects/TaskId";
import { EntityNotFoundException } from "../../domain/exceptions/EntityNotFoundException";
import {
  MONGO_UNIT_OF_WORK,
  type IMongoUnitOfWork,
} from "../../domain/ports/mongo-unit-of-work.port";
import { TaskOutboxService } from "../../infrastructure/outbox/task-outbox.service";

@CommandHandler(ChangeTaskStatusCommand)
export class ChangeTaskStatusHandler implements ICommandHandler<ChangeTaskStatusCommand, void> {
  constructor(
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
    @Inject(MONGO_UNIT_OF_WORK)
    private readonly unitOfWork: IMongoUnitOfWork,
    private readonly taskOutboxService: TaskOutboxService,
  ) {}

  async execute(command: ChangeTaskStatusCommand): Promise<void> {
    const taskId = new TaskId(command.taskId);
    const task = await this.taskRepository.loadAggregateByIdAsync(taskId);

    if (!task) {
      throw new EntityNotFoundException("Task", command.taskId);
    }

    const previousStatus = task.getStatus().getValue();
    task.changeStatus(command.newStatus);
    const newStatus = task.getStatus().getValue();

    await this.unitOfWork.run(async (session) => {
      await this.taskRepository.saveAsync(task, { session });
      await this.taskOutboxService.enqueueTaskStatusChanged(
        {
          eventId: randomUUID(),
          occurredAt: new Date().toISOString(),
          newStatus,
          previousStatus,
          taskId: command.taskId,
          workspaceId: task.getWorkspaceId(),
        },
        session,
      );
    });
  }
}

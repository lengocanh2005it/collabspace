// src/application/usecases/delete-task.handler.ts
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { ForbiddenException, Inject, NotFoundException } from "@nestjs/common";
import { meetsWorkspaceRole } from "@collabspace/shared";
import { randomUUID } from "node:crypto";
import { DeleteTaskCommand } from "../commands/delete-task.command";
import { ITaskRepository as ITaskRepositoryToken } from "../ports/ITaskRepository";
import type { ITaskRepository } from "../ports/ITaskRepository";
import { type IWorkspaceClient, WORKSPACE_CLIENT_TOKEN } from "../ports/IWorkspaceClient";
import { TaskId } from "../../domain/value-objects/TaskId";
import {
  MONGO_UNIT_OF_WORK,
  type IMongoUnitOfWork,
} from "../../domain/ports/mongo-unit-of-work.port";
import { TaskOutboxService } from "../../infrastructure/outbox/task-outbox.service";

@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<DeleteTaskCommand, void> {
  constructor(
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
    @Inject(WORKSPACE_CLIENT_TOKEN)
    private readonly workspaceClient: IWorkspaceClient,
    @Inject(MONGO_UNIT_OF_WORK)
    private readonly unitOfWork: IMongoUnitOfWork,
    private readonly taskOutboxService: TaskOutboxService,
  ) {}

  async execute(command: DeleteTaskCommand): Promise<void> {
    const taskId = new TaskId(command.taskId);
    const task = await this.taskRepository.loadAggregateByIdAsync(taskId);
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const membership = await this.workspaceClient.getMembershipAsync(
      task.getWorkspaceId(),
      command.actorId,
    );
    if (!membership?.isMember || !membership.role) {
      throw new ForbiddenException("You are not a member of this workspace");
    }

    const canDeleteAnyTask = meetsWorkspaceRole(membership.role, "manager");
    const isCreator = task.getCreatedBy().getUserId() === command.actorId;
    if (!canDeleteAnyTask && !isCreator) {
      throw new ForbiddenException(
        "Only workspace owners, managers, or the task creator can delete this task",
      );
    }

    const status = task.getStatus().getValue();
    task.delete();

    await this.unitOfWork.run(async (session) => {
      await this.taskRepository.saveAsync(task, { session });
      await this.taskOutboxService.enqueueTaskDeleted(
        {
          eventId: randomUUID(),
          occurredAt: new Date().toISOString(),
          actorId: command.actorId,
          status,
          taskId: command.taskId,
          workspaceId: task.getWorkspaceId(),
        },
        session,
      );
    });
  }
}

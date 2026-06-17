// src/application/usecases/delete-task.handler.ts
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { ForbiddenException, Inject, NotFoundException } from "@nestjs/common";
import { meetsWorkspaceRole } from "@collabspace/shared";
import { DeleteTaskCommand } from "../commands/delete-task.command";
import { ITaskRepository as ITaskRepositoryToken } from "../ports/ITaskRepository";
import type { ITaskRepository } from "../ports/ITaskRepository";
import { type IWorkspaceClient, WORKSPACE_CLIENT_TOKEN } from "../ports/IWorkspaceClient";
import { TaskId } from "../../domain/value-objects/TaskId";

@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<DeleteTaskCommand, void> {
  constructor(
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
    @Inject(WORKSPACE_CLIENT_TOKEN)
    private readonly workspaceClient: IWorkspaceClient,
  ) {}

  async execute(command: DeleteTaskCommand): Promise<void> {
    const taskId = new TaskId(command.taskId);
    const task = await this.taskRepository.findByIdAsync(taskId);
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

    await this.taskRepository.deleteAsync(taskId);
  }
}

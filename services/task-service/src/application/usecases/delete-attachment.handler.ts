// src/application/usecases/delete-attachment.handler.ts
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Inject } from "@nestjs/common";
import { DeleteAttachmentCommand } from "../commands/delete-attachment.command";
import { ITaskRepository as ITaskRepositoryToken } from "../ports/ITaskRepository";
import type { ITaskRepository } from "../ports/ITaskRepository";
import { AzureBlobService } from "../../infrastructure/services/azure-blob.service";
import { TaskId } from "../../domain/value-objects/TaskId";
import { EntityNotFoundException } from "../../domain/exceptions/EntityNotFoundException";

@CommandHandler(DeleteAttachmentCommand)
export class DeleteAttachmentHandler implements ICommandHandler<DeleteAttachmentCommand> {
  constructor(
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
    private readonly azureBlobService: AzureBlobService,
  ) {}

  async execute(command: DeleteAttachmentCommand): Promise<void> {
    // Step 1: Validate task exists
    const taskId = new TaskId(command.taskId);
    const task = await this.taskRepository.loadAggregateByIdAsync(taskId);
    if (!task) {
      throw new EntityNotFoundException("Task", command.taskId);
    }

    // Step 2: Delete file from Azure Blob Storage using full file URL
    await this.azureBlobService.deleteFile(command.fileUrl);

    // Step 3: Remove attachment via event-sourced aggregate
    task.removeAttachment(command.fileUrl);
    await this.taskRepository.saveAsync(task);
  }
}

// src/application/usecases/upload-attachment.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UploadAttachmentCommand } from '../commands/upload-attachment.command';
import { ITaskRepository } from '../ports/ITaskRepository';
import { AzureBlobService } from '../../infrastructure/services/azure-blob.service';
import { TaskId } from '../../domain/value-objects/TaskId';
import { EntityNotFoundException } from '../../domain/exceptions/EntityNotFoundException';

export interface UploadAttachmentResponse {
  fileUrl: string;
  fileName: string;
  fileSize: number;
}

@CommandHandler(UploadAttachmentCommand)
export class UploadAttachmentHandler implements ICommandHandler<UploadAttachmentCommand> {
  constructor(
    @Inject(ITaskRepository as any)
    private readonly taskRepository: ITaskRepository,
    private readonly azureBlobService: AzureBlobService,
  ) {}

  async execute(command: UploadAttachmentCommand): Promise<UploadAttachmentResponse> {
    // Step 1: Validate task exists
    const taskId = new TaskId(command.taskId);
    const task = await this.taskRepository.findByIdAsync(taskId);
    if (!task) {
      throw new EntityNotFoundException('Task', command.taskId);
    }

    // Step 2: Upload file to Azure Blob Storage
    const fileUrl = await this.azureBlobService.uploadFile(command.file, command.taskId);

    // Step 3: Add attachment to task in database
    await this.taskRepository.addAttachmentAsync(taskId, fileUrl);

    // Step 4: Return response
    return {
      fileUrl,
      fileName: command.file.originalname,
      fileSize: command.file.size,
    };
  }
}

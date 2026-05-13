import { DeleteAttachmentHandler } from './delete-attachment.handler';
import { DeleteAttachmentCommand } from '../commands/delete-attachment.command';
import { ITaskRepository } from '../ports/ITaskRepository';
import { AzureBlobService } from '../../infrastructure/services/azure-blob.service';
import { Task } from '../../domain/entities/Task';
import { TaskId } from '../../domain/value-objects/TaskId';
import { UserSnapshot } from '../../domain/value-objects/UserSnapshot';
import { EntityNotFoundException } from '../../domain/exceptions/EntityNotFoundException';

describe('DeleteAttachmentHandler', () => {
  let handler: DeleteAttachmentHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;
  let mockAzureBlobService: jest.Mocked<AzureBlobService>;

  beforeEach(() => {
    mockTaskRepo = {
      addAsync: jest.fn(),
      updateAsync: jest.fn(),
      deleteAsync: jest.fn(),
      findByIdAsync: jest.fn(),
      findByWorkspaceIdAsync: jest.fn(),
      addAttachmentAsync: jest.fn(),
      removeAttachmentAsync: jest.fn(),
    } as any;

    mockAzureBlobService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    } as any;

    handler = new DeleteAttachmentHandler(mockTaskRepo, mockAzureBlobService);
  });

  const createMockTask = () => {
    const creatorSnapshot = UserSnapshot.create('creator-1', 'c@c.c', 'Creator', 'Creator', 'url');
    return Task.restore(new TaskId('123e4567-e89b-12d3-a456-426614174000'), 'Title', 'Desc', 'TODO', 'workspace-1', null, null, creatorSnapshot, new Date(), new Date(), ['https://azure.blob/test.jpg']);
  };

  it('should delete attachment successfully', async () => {
    const command = new DeleteAttachmentCommand('123e4567-e89b-12d3-a456-426614174000', 'https://azure.blob/test.jpg');
    const task = createMockTask();

    mockTaskRepo.findByIdAsync.mockResolvedValue(task);
    mockAzureBlobService.deleteFile.mockResolvedValue();

    await handler.execute(command);

    expect(mockAzureBlobService.deleteFile).toHaveBeenCalledWith('https://azure.blob/test.jpg');
    expect(mockTaskRepo.removeAttachmentAsync).toHaveBeenCalledWith(expect.any(TaskId), 'https://azure.blob/test.jpg');
  });

  it('should throw EntityNotFoundException if task does not exist', async () => {
    const command = new DeleteAttachmentCommand('123e4567-e89b-12d3-a456-426614174000', 'https://azure.blob/test.jpg');

    mockTaskRepo.findByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(EntityNotFoundException);
    expect(mockAzureBlobService.deleteFile).not.toHaveBeenCalled();
    expect(mockTaskRepo.removeAttachmentAsync).not.toHaveBeenCalled();
  });
});

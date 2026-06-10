import { UploadAttachmentHandler } from "./upload-attachment.handler";
import { UploadAttachmentCommand } from "../commands/upload-attachment.command";
import { ITaskRepository } from "../ports/ITaskRepository";
import { createMockTaskRepository } from "../../test-utils/mock-task-repository";
import { AzureBlobService } from "../../infrastructure/services/azure-blob.service";
import { Task } from "../../domain/entities/Task";
import { TaskId } from "../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";
import { EntityNotFoundException } from "../../domain/exceptions/EntityNotFoundException";
import type { UploadedFile } from "../../common/types/uploaded-file";

describe("UploadAttachmentHandler", () => {
  let handler: UploadAttachmentHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;
  let mockAzureBlobService: jest.Mocked<AzureBlobService>;

  beforeEach(() => {
    mockTaskRepo = createMockTaskRepository();

    mockAzureBlobService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    } as any;

    handler = new UploadAttachmentHandler(mockTaskRepo, mockAzureBlobService);
  });

  const createMockTask = () => {
    const creatorSnapshot = UserSnapshot.create(
      "creator-1",
      "c@c.c",
      "Creator",
      "Creator",
      "url",
    );
    return Task.restore(
      new TaskId("123e4567-e89b-12d3-a456-426614174000"),
      "Title",
      "Desc",
      "TODO",
      "workspace-1",
      null,
      null,
      creatorSnapshot,
      new Date(),
      new Date(),
      [],
    );
  };

  it("should upload attachment successfully", async () => {
    const mockFile = {
      originalname: "test.jpg",
      mimetype: "image/jpeg",
      size: 1024,
      buffer: Buffer.from("test"),
    } as UploadedFile;
    const command = new UploadAttachmentCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      mockFile,
    );
    const task = createMockTask();

    mockTaskRepo.loadAggregateByIdAsync.mockResolvedValue(task);
    mockAzureBlobService.uploadFile.mockResolvedValue(
      "https://azure.blob/test.jpg",
    );

    const result = await handler.execute(command);

    expect(result.fileUrl).toBe("https://azure.blob/test.jpg");
    expect(result.fileName).toBe("test.jpg");
    expect(result.fileSize).toBe(1024);
    expect(mockAzureBlobService.uploadFile).toHaveBeenCalledWith(
      mockFile,
      "123e4567-e89b-12d3-a456-426614174000",
    );
    expect(mockTaskRepo.saveAsync).toHaveBeenCalledWith(task);
  });

  it("should throw EntityNotFoundException if task does not exist", async () => {
    const mockFile = {
      originalname: "test.jpg",
      mimetype: "image/jpeg",
      size: 1024,
      buffer: Buffer.from("test"),
    } as UploadedFile;
    const command = new UploadAttachmentCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      mockFile,
    );

    mockTaskRepo.loadAggregateByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(
      EntityNotFoundException,
    );
    expect(mockAzureBlobService.uploadFile).not.toHaveBeenCalled();
    expect(mockTaskRepo.saveAsync).not.toHaveBeenCalled();
  });
});

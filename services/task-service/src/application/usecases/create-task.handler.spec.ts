import { BadRequestException } from "@nestjs/common";
import { CreateTaskHandler } from "./create-task.handler";
import { CreateTaskCommand } from "../commands/create-task.command";
import { ITaskRepository } from "../ports/ITaskRepository";
import { createMockTaskRepository } from "../../test-utils/mock-task-repository";
import { IUserReplicaRepository } from "../ports/IUserReplicaRepository";
import { UserReplica } from "../../infrastructure/persistence/user-replica.schema";

describe("CreateTaskHandler", () => {
  let handler: CreateTaskHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;
  let mockUserReplicaRepo: jest.Mocked<IUserReplicaRepository>;

  beforeEach(() => {
    mockTaskRepo = createMockTaskRepository();

    mockUserReplicaRepo = {
      addAsync: jest.fn(),
      updateAsync: jest.fn(),
      findByIdAsync: jest.fn(),
    };

    handler = new CreateTaskHandler(mockTaskRepo, mockUserReplicaRepo);
  });

  it("should create a task successfully when creator exists and is active", async () => {
    // Arrange
    const command = new CreateTaskCommand(
      "New Task",
      "Task Description",
      "user-123",
      "User Name",
      "workspace-123",
    );

    const mockReplica: UserReplica = {
      userId: "user-123",
      email: "user@example.com",
      fullName: "User Name",
      displayName: "User",
      avatarUrl: "http://avatar.com",
      isActive: true,
      lastSyncedAt: new Date(),
    };

    mockUserReplicaRepo.findByIdAsync.mockResolvedValue(mockReplica);
    mockTaskRepo.saveAsync.mockResolvedValue();

    // Act
    const taskId = await handler.execute(command);

    // Assert
    expect(taskId).toBeDefined();
    expect(mockUserReplicaRepo.findByIdAsync).toHaveBeenCalledWith("user-123");
    expect(mockTaskRepo.saveAsync).toHaveBeenCalledTimes(1);

    const savedTask = mockTaskRepo.saveAsync.mock.calls[0][0];
    expect(savedTask.getTitle()).toBe("New Task");
    expect(savedTask.getDescription()).toBe("Task Description");
    expect(savedTask.getWorkspaceId()).toBe("workspace-123");
    expect(savedTask.getCreatedBy().getUserId()).toBe("user-123");
  });

  it("should throw BadRequestException if creator does not exist", async () => {
    // Arrange
    const command = new CreateTaskCommand(
      "New Task",
      "Task Description",
      "non-existent-user",
      "Unknown",
      "workspace-123",
    );

    mockUserReplicaRepo.findByIdAsync.mockResolvedValue(null);

    // Act & Assert
    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    await expect(handler.execute(command)).rejects.toThrow(
      "Tài khoản người tạo Task không tồn tại hoặc đã bị khóa!",
    );
    expect(mockTaskRepo.saveAsync).not.toHaveBeenCalled();
  });

  it("should throw BadRequestException if creator is inactive", async () => {
    // Arrange
    const command = new CreateTaskCommand(
      "New Task",
      "Task Description",
      "user-123",
      "User Name",
      "workspace-123",
    );

    const mockReplica: UserReplica = {
      userId: "user-123",
      email: "user@example.com",
      fullName: "User Name",
      displayName: "User",
      avatarUrl: "http://avatar.com",
      isActive: false, // inactive!
      lastSyncedAt: new Date(),
    };

    mockUserReplicaRepo.findByIdAsync.mockResolvedValue(mockReplica);

    // Act & Assert
    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    expect(mockTaskRepo.saveAsync).not.toHaveBeenCalled();
  });
});

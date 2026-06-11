import { BadRequestException } from "@nestjs/common";
import { CreateTaskHandler } from "./create-task.handler";
import { CreateTaskCommand } from "../commands/create-task.command";
import { ITaskRepository } from "../ports/ITaskRepository";
import { createMockTaskRepository } from "../../test-utils/mock-task-repository";
import { UserReplicaLookupService } from "../services/user-replica-lookup.service";
import { UserReplica } from "../../infrastructure/persistence/user-replica.schema";

describe("CreateTaskHandler", () => {
  let handler: CreateTaskHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;
  let mockUserReplicaLookup: jest.Mocked<
    Pick<UserReplicaLookupService, "findActiveByIdAsync">
  >;

  beforeEach(() => {
    mockTaskRepo = createMockTaskRepository();

    mockUserReplicaLookup = {
      findActiveByIdAsync: jest.fn(),
    };

    handler = new CreateTaskHandler(
      mockTaskRepo,
      mockUserReplicaLookup as UserReplicaLookupService,
    );
  });

  it("should create a task successfully when creator exists and is active", async () => {
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
    };

    mockUserReplicaLookup.findActiveByIdAsync.mockResolvedValue(mockReplica);
    mockTaskRepo.saveAsync.mockResolvedValue();

    const taskId = await handler.execute(command);

    expect(taskId).toBeDefined();
    expect(mockUserReplicaLookup.findActiveByIdAsync).toHaveBeenCalledWith(
      "user-123",
    );
    expect(mockTaskRepo.saveAsync).toHaveBeenCalledTimes(1);
  });

  it("should throw BadRequestException if creator does not exist", async () => {
    const command = new CreateTaskCommand(
      "New Task",
      "Task Description",
      "non-existent-user",
      "Unknown",
      "workspace-123",
    );

    mockUserReplicaLookup.findActiveByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    expect(mockTaskRepo.saveAsync).not.toHaveBeenCalled();
  });
});

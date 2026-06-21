import { BadRequestException } from "@nestjs/common";
import { CreateTaskHandler } from "./create-task.handler";
import { CreateTaskCommand } from "../commands/create-task.command";
import type { ITaskRepository } from "../ports/ITaskRepository";
import { createMockTaskRepository } from "../../test-utils/mock-task-repository";
import type { UserReplicaLookupService } from "../services/user-replica-lookup.service";
import type { UserReplica } from "../../infrastructure/persistence/user-replica.schema";
import type { IMongoUnitOfWork } from "../../domain/ports/mongo-unit-of-work.port";
import type { TaskOutboxService } from "../../infrastructure/outbox/task-outbox.service";
import { Task } from "../../domain/entities/Task";

describe("CreateTaskHandler", () => {
  let handler: CreateTaskHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;
  let mockUserReplicaLookup: jest.Mocked<Pick<UserReplicaLookupService, "findActiveByIdAsync">>;
  let mockUnitOfWork: jest.Mocked<IMongoUnitOfWork>;
  let mockTaskOutboxService: jest.Mocked<Pick<TaskOutboxService, "enqueueTaskCreated">>;
  const session = {} as never;

  beforeEach(() => {
    mockTaskRepo = createMockTaskRepository();

    mockUserReplicaLookup = {
      findActiveByIdAsync: jest.fn(),
    };
    mockUnitOfWork = {
      run: jest.fn(async (work) => work(session)),
    };
    mockTaskOutboxService = {
      enqueueTaskCreated: jest.fn().mockResolvedValue(undefined),
    };

    handler = new CreateTaskHandler(
      mockTaskRepo,
      mockUserReplicaLookup as UserReplicaLookupService,
      mockUnitOfWork,
      mockTaskOutboxService as TaskOutboxService,
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
    expect(mockUserReplicaLookup.findActiveByIdAsync).toHaveBeenCalledWith("user-123");
    expect(mockTaskRepo.saveAsync).toHaveBeenCalledWith(expect.any(Task), { session });
    expect(mockTaskOutboxService.enqueueTaskCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorId: "user-123",
        status: "TODO",
        taskId,
        taskTitle: "New Task",
        workspaceId: "workspace-123",
      }),
      session,
    );
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

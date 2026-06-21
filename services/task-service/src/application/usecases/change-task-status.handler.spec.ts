import { ChangeTaskStatusHandler } from "./change-task-status.handler";
import { ChangeTaskStatusCommand } from "../commands/change-task-status.command";
import type { ITaskRepository } from "../ports/ITaskRepository";
import { createMockTaskRepository } from "../../test-utils/mock-task-repository";
import { Task } from "../../domain/entities/Task";
import { TaskId } from "../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";
import { EntityNotFoundException } from "../../domain/exceptions/EntityNotFoundException";
import { BusinessRuleException } from "../../domain/exceptions/BusinessRuleException";
import type { IMongoUnitOfWork } from "../../domain/ports/mongo-unit-of-work.port";
import type { TaskOutboxService } from "../../infrastructure/outbox/task-outbox.service";

describe("ChangeTaskStatusHandler", () => {
  let handler: ChangeTaskStatusHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;
  let mockUnitOfWork: jest.Mocked<IMongoUnitOfWork>;
  let mockTaskOutboxService: jest.Mocked<Pick<TaskOutboxService, "enqueueTaskStatusChanged">>;
  const session = {} as never;

  beforeEach(() => {
    mockTaskRepo = createMockTaskRepository();
    mockUnitOfWork = {
      run: jest.fn(async (work) => work(session)),
    };
    mockTaskOutboxService = {
      enqueueTaskStatusChanged: jest.fn().mockResolvedValue(undefined),
    };

    handler = new ChangeTaskStatusHandler(
      mockTaskRepo,
      mockUnitOfWork,
      mockTaskOutboxService as TaskOutboxService,
    );
  });

  const createMockTask = (status: string = "TODO") => {
    const creatorSnapshot = UserSnapshot.create("creator-1", "c@c.c", "Creator", "Creator", "url");
    return Task.restore(
      new TaskId("123e4567-e89b-12d3-a456-426614174000"),
      "Task Title",
      "Desc",
      status,
      "workspace-1",
      null,
      null,
      null,
      creatorSnapshot,
      new Date(),
      new Date(),
      [],
    );
  };

  it("should change status of an existing task", async () => {
    const task = createMockTask("TODO");
    const command = new ChangeTaskStatusCommand("123e4567-e89b-12d3-a456-426614174000", "DOING");

    mockTaskRepo.loadAggregateByIdAsync.mockResolvedValue(task);

    await handler.execute(command);

    expect(task.getStatus().getValue()).toBe("DOING");
    expect(mockTaskRepo.saveAsync).toHaveBeenCalledWith(task, { session });
    expect(mockTaskOutboxService.enqueueTaskStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        newStatus: "DOING",
        previousStatus: "TODO",
        taskId: command.taskId,
        workspaceId: "workspace-1",
      }),
      session,
    );
  });

  it("should throw EntityNotFoundException if task does not exist", async () => {
    const command = new ChangeTaskStatusCommand("123e4567-e89b-12d3-a456-426614174000", "DOING");
    mockTaskRepo.loadAggregateByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(EntityNotFoundException);
    expect(mockTaskRepo.saveAsync).not.toHaveBeenCalled();
  });

  it("should throw BusinessRuleException when transitioning from DONE to TODO", async () => {
    const task = createMockTask("DONE");
    const command = new ChangeTaskStatusCommand("123e4567-e89b-12d3-a456-426614174000", "TODO");

    mockTaskRepo.loadAggregateByIdAsync.mockResolvedValue(task);

    await expect(handler.execute(command)).rejects.toThrow(BusinessRuleException);
    await expect(handler.execute(command)).rejects.toThrow(
      "Business Rule Violated: Cannot move from DONE to TODO",
    );

    // Status should remain unchanged
    expect(task.getStatus().getValue()).toBe("DONE");
    expect(mockTaskRepo.saveAsync).not.toHaveBeenCalled();
  });

  it("should allow transitioning from TODO to DONE", async () => {
    const task = createMockTask("TODO");
    const command = new ChangeTaskStatusCommand("123e4567-e89b-12d3-a456-426614174000", "DONE");

    mockTaskRepo.loadAggregateByIdAsync.mockResolvedValue(task);

    await handler.execute(command);

    expect(task.getStatus().getValue()).toBe("DONE");
    expect(mockTaskRepo.saveAsync).toHaveBeenCalledWith(task, { session });
  });
});

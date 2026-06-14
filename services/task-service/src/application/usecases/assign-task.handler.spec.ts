import { AssignTaskHandler } from "./assign-task.handler";
import { AssignTaskCommand } from "../commands/assign-task.command";
import { ITaskRepository } from "../ports/ITaskRepository";
import { createMockTaskRepository } from "../../test-utils/mock-task-repository";
import { UserReplicaLookupService } from "../services/user-replica-lookup.service";
import { TaskOutboxService } from "../../infrastructure/outbox/task-outbox.service";
import { Task } from "../../domain/entities/Task";
import { TaskId } from "../../domain/value-objects/TaskId";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";
import { UserReplica } from "../../infrastructure/persistence/user-replica.schema";
import { EntityNotFoundException } from "../../domain/exceptions/EntityNotFoundException";
import { BusinessRuleException } from "../../domain/exceptions/BusinessRuleException";

describe("AssignTaskHandler", () => {
  let handler: AssignTaskHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;
  let mockUserReplicaLookup: jest.Mocked<
    Pick<UserReplicaLookupService, "findActiveByIdAsync">
  >;
  let mockTaskOutboxService: jest.Mocked<TaskOutboxService>;

  beforeEach(() => {
    mockTaskRepo = createMockTaskRepository();

    mockUserReplicaLookup = {
      findActiveByIdAsync: jest.fn(),
    };

    mockTaskOutboxService = {
      enqueueTaskAssigned: jest.fn(),
      enqueueTaskCommented: jest.fn(),
    } as any;

    handler = new AssignTaskHandler(
      mockTaskRepo,
      mockUserReplicaLookup as UserReplicaLookupService,
      mockTaskOutboxService,
    );
  });

  const createMockTask = () => {
    const creatorSnapshot = UserSnapshot.create(
      "creator-1",
      "creator@test.com",
      "Creator",
      "Creator",
      "url",
    );
    return Task.create(
      new TaskId("123e4567-e89b-12d3-a456-426614174000"),
      "Task Title",
      "Desc",
      "workspace-1",
      creatorSnapshot,
    );
  };

  const createMockReplica = (id: string, active: boolean): UserReplica => ({
    userId: id,
    email: `${id}@test.com`,
    fullName: `Name ${id}`,
    displayName: `Display ${id}`,
    avatarUrl: "url",
    isActive: active,
    lastSyncedAt: new Date(),
  });

  it("should assign a task and emit RabbitMQ event", async () => {
    const task = createMockTask();
    const command = new AssignTaskCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      "assigner-1",
      "assignee-1",
    );

    mockTaskRepo.loadAggregateByIdAsync.mockResolvedValue(task);
    mockUserReplicaLookup.findActiveByIdAsync.mockImplementation(async (id) => {
      if (id === "assigner-1") return createMockReplica("assigner-1", true);
      if (id === "assignee-1") return createMockReplica("assignee-1", true);
      return null;
    });

    await handler.execute(command);

    expect(task.getAssigneeId()).toBe("assignee-1");
    expect(mockTaskRepo.saveAsync).toHaveBeenCalledWith(task);
    expect(mockTaskOutboxService.enqueueTaskAssigned).toHaveBeenCalledTimes(1);
    expect(mockTaskOutboxService.enqueueTaskAssigned).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: expect.any(String),
        occurredAt: expect.any(String),
        taskId: "123e4567-e89b-12d3-a456-426614174000",
        recipientId: "assignee-1",
        actorId: "assigner-1",
        assignedAt: expect.any(String),
        workspaceId: "workspace-1",
      }),
    );
  });

  it("should unassign a task when assigneeId is not provided", async () => {
    const task = createMockTask();
    task.assignTo(
      "old-assignee",
      UserSnapshot.create("old", "o@o.c", "Old", "Old", "url"),
    );

    const command = new AssignTaskCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      "assigner-1",
      "",
    );

    mockTaskRepo.loadAggregateByIdAsync.mockResolvedValue(task);
    mockUserReplicaLookup.findActiveByIdAsync.mockImplementation(async (id) => {
      if (id === "assigner-1") return createMockReplica("assigner-1", true);
      return null;
    });

    await handler.execute(command);

    expect(task.getAssigneeId()).toBeNull();
    expect(mockTaskRepo.saveAsync).toHaveBeenCalledWith(task);
    expect(mockTaskOutboxService.enqueueTaskAssigned).not.toHaveBeenCalled();
  });

  it("should throw EntityNotFoundException if task does not exist", async () => {
    const command = new AssignTaskCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      "assigner-1",
      "assignee-1",
    );
    mockTaskRepo.loadAggregateByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(command)).rejects.toThrow(
      EntityNotFoundException,
    );
  });

  it("should throw BusinessRuleException if assigner is inactive", async () => {
    const task = createMockTask();
    const command = new AssignTaskCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      "assigner-1",
      "assignee-1",
    );

    mockTaskRepo.loadAggregateByIdAsync.mockResolvedValue(task);
    mockUserReplicaLookup.findActiveByIdAsync.mockImplementation(async (id) => {
      if (id === "assigner-1") return createMockReplica("assigner-1", false); // INACTIVE
      return null;
    });

    await expect(handler.execute(command)).rejects.toThrow(
      BusinessRuleException,
    );
  });

  it("should throw BusinessRuleException if assignee is inactive", async () => {
    const task = createMockTask();
    const command = new AssignTaskCommand(
      "123e4567-e89b-12d3-a456-426614174000",
      "assigner-1",
      "assignee-1",
    );

    mockTaskRepo.loadAggregateByIdAsync.mockResolvedValue(task);
    mockUserReplicaLookup.findActiveByIdAsync.mockImplementation(async (id) => {
      if (id === "assigner-1") return createMockReplica("assigner-1", true);
      if (id === "assignee-1") return createMockReplica("assignee-1", false); // INACTIVE
      return null;
    });

    await expect(handler.execute(command)).rejects.toThrow(
      BusinessRuleException,
    );
  });
});

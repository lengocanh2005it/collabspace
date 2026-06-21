import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { DeleteTaskHandler } from "./delete-task.handler";
import { DeleteTaskCommand } from "../commands/delete-task.command";
import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IWorkspaceClient } from "../ports/IWorkspaceClient";
import { createMockTaskRepository } from "../../test-utils/mock-task-repository";
import { TaskId } from "../../domain/value-objects/TaskId";
import { Task } from "../../domain/entities/Task";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";
import type { IMongoUnitOfWork } from "../../domain/ports/mongo-unit-of-work.port";
import type { TaskOutboxService } from "../../infrastructure/outbox/task-outbox.service";

describe("DeleteTaskHandler", () => {
  let handler: DeleteTaskHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;
  let mockWorkspaceClient: jest.Mocked<IWorkspaceClient>;
  let mockUnitOfWork: jest.Mocked<IMongoUnitOfWork>;
  let mockTaskOutboxService: jest.Mocked<Pick<TaskOutboxService, "enqueueTaskDeleted">>;

  const taskId = "123e4567-e89b-12d3-a456-426614174000";
  const workspaceId = "ws-1";
  const creator = UserSnapshot.create("creator-1", "c@test.com", "Creator", "Creator", null);
  const session = {} as never;

  function buildTask(): Task {
    return Task.create(new TaskId(taskId), "Demo task", "Details", workspaceId, creator, {
      projectId: "project-1",
    });
  }

  beforeEach(() => {
    mockTaskRepo = createMockTaskRepository();
    mockWorkspaceClient = {
      getMembershipAsync: jest.fn(),
      validateWorkspaceAsync: jest.fn(),
      checkUserPermissionAsync: jest.fn(),
      getWorkspaceMemberAsync: jest.fn(),
    };
    mockUnitOfWork = {
      run: jest.fn(async (work) => work(session)),
    };
    mockTaskOutboxService = {
      enqueueTaskDeleted: jest.fn().mockResolvedValue(undefined),
    };
    handler = new DeleteTaskHandler(
      mockTaskRepo,
      mockWorkspaceClient,
      mockUnitOfWork,
      mockTaskOutboxService as TaskOutboxService,
    );
    mockTaskRepo.loadAggregateByIdAsync.mockResolvedValue(buildTask());
  });

  it("allows workspace owner to delete any task", async () => {
    mockWorkspaceClient.getMembershipAsync.mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    await handler.execute(new DeleteTaskCommand(taskId, "owner-1"));

    expect(mockTaskRepo.saveAsync).toHaveBeenCalledWith(expect.any(Task), { session });
    expect(mockTaskOutboxService.enqueueTaskDeleted).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "owner-1",
        status: "TODO",
        taskId,
        workspaceId,
      }),
      session,
    );
  });

  it("allows workspace manager to delete any task", async () => {
    mockWorkspaceClient.getMembershipAsync.mockResolvedValue({
      isMember: true,
      role: "manager",
    });

    await handler.execute(new DeleteTaskCommand(taskId, "manager-1"));

    expect(mockTaskRepo.saveAsync).toHaveBeenCalledTimes(1);
  });

  it("allows member to delete their own task", async () => {
    mockWorkspaceClient.getMembershipAsync.mockResolvedValue({
      isMember: true,
      role: "member",
    });

    await handler.execute(new DeleteTaskCommand(taskId, "creator-1"));

    expect(mockTaskRepo.saveAsync).toHaveBeenCalledTimes(1);
  });

  it("rejects member deleting another users task", async () => {
    mockWorkspaceClient.getMembershipAsync.mockResolvedValue({
      isMember: true,
      role: "member",
    });

    await expect(handler.execute(new DeleteTaskCommand(taskId, "other-member"))).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockTaskRepo.saveAsync).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when task is missing", async () => {
    mockTaskRepo.loadAggregateByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(new DeleteTaskCommand(taskId, "creator-1"))).rejects.toThrow(
      NotFoundException,
    );
  });
});

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { DeleteTaskHandler } from "./delete-task.handler";
import { DeleteTaskCommand } from "../commands/delete-task.command";
import type { ITaskRepository } from "../ports/ITaskRepository";
import type { IWorkspaceClient } from "../ports/IWorkspaceClient";
import { createMockTaskRepository } from "../../test-utils/mock-task-repository";
import { TaskId } from "../../domain/value-objects/TaskId";
import { Task } from "../../domain/entities/Task";
import { UserSnapshot } from "../../domain/value-objects/UserSnapshot";

describe("DeleteTaskHandler", () => {
  let handler: DeleteTaskHandler;
  let mockTaskRepo: jest.Mocked<ITaskRepository>;
  let mockWorkspaceClient: jest.Mocked<IWorkspaceClient>;

  const taskId = "123e4567-e89b-12d3-a456-426614174000";
  const workspaceId = "ws-1";
  const creator = UserSnapshot.create("creator-1", "c@test.com", "Creator", "Creator", null);

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
    handler = new DeleteTaskHandler(mockTaskRepo, mockWorkspaceClient);
    mockTaskRepo.findByIdAsync.mockResolvedValue(buildTask());
  });

  it("allows workspace owner to delete any task", async () => {
    mockWorkspaceClient.getMembershipAsync.mockResolvedValue({
      isMember: true,
      role: "owner",
    });

    await handler.execute(new DeleteTaskCommand(taskId, "owner-1"));

    expect(mockTaskRepo.deleteAsync).toHaveBeenCalledWith(expect.any(TaskId));
  });

  it("allows workspace manager to delete any task", async () => {
    mockWorkspaceClient.getMembershipAsync.mockResolvedValue({
      isMember: true,
      role: "manager",
    });

    await handler.execute(new DeleteTaskCommand(taskId, "manager-1"));

    expect(mockTaskRepo.deleteAsync).toHaveBeenCalledTimes(1);
  });

  it("allows member to delete their own task", async () => {
    mockWorkspaceClient.getMembershipAsync.mockResolvedValue({
      isMember: true,
      role: "member",
    });

    await handler.execute(new DeleteTaskCommand(taskId, "creator-1"));

    expect(mockTaskRepo.deleteAsync).toHaveBeenCalledTimes(1);
  });

  it("rejects member deleting another users task", async () => {
    mockWorkspaceClient.getMembershipAsync.mockResolvedValue({
      isMember: true,
      role: "member",
    });

    await expect(handler.execute(new DeleteTaskCommand(taskId, "other-member"))).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockTaskRepo.deleteAsync).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when task is missing", async () => {
    mockTaskRepo.findByIdAsync.mockResolvedValue(null);

    await expect(handler.execute(new DeleteTaskCommand(taskId, "creator-1"))).rejects.toThrow(
      NotFoundException,
    );
  });
});

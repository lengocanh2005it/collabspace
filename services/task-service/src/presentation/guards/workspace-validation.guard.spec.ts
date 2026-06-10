import { ExecutionContext } from "@nestjs/common";
import type { ITaskRepository } from "../../application/ports/ITaskRepository";
import type { WorkspaceMockService } from "../../infrastructure/services/workspace.mock.service";
import type { AppRequest } from "../http/request-context";
import { WorkspaceValidationGuard } from "./workspace-validation.guard";

type WorkspaceGuardRequest = AppRequest<
  Record<string, string | undefined> & { id?: string; taskId?: string },
  unknown,
  { workspaceId?: string },
  Record<string, string | string[] | undefined> & { workspaceId?: string }
>;

type WorkspaceServiceDouble = Pick<
  WorkspaceMockService,
  "validateWorkspaceAsync" | "checkUserPermissionAsync"
>;

type TaskRepositoryDouble = Pick<ITaskRepository, "findByIdAsync">;

describe("WorkspaceValidationGuard", () => {
  const taskId = "550e8400-e29b-41d4-a716-446655440000";

  function createContext(request: WorkspaceGuardRequest): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it("should validate membership using workspaceId from the request body", async () => {
    const workspaceService: jest.Mocked<WorkspaceServiceDouble> = {
      validateWorkspaceAsync: jest.fn().mockResolvedValue(true),
      checkUserPermissionAsync: jest.fn().mockResolvedValue(true),
    };
    const taskRepository: jest.Mocked<TaskRepositoryDouble> = {
      findByIdAsync: jest.fn(),
    };
    const guard = new WorkspaceValidationGuard(
      workspaceService as unknown as WorkspaceMockService,
      taskRepository as unknown as ITaskRepository,
    );

    const request = {
      headers: { "x-user-name": "Dev User" },
      user: { id: "user-123", name: "Dev User" },
      body: { workspaceId: "workspace-001" },
      query: {},
      params: {},
    } as unknown as WorkspaceGuardRequest;

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(taskRepository.findByIdAsync).not.toHaveBeenCalled();
    expect(workspaceService.validateWorkspaceAsync).toHaveBeenCalledWith(
      "workspace-001",
      "user-123",
    );
    expect(workspaceService.checkUserPermissionAsync).toHaveBeenCalledWith(
      "workspace-001",
      "user-123",
      "member",
    );
    expect(request.workspace).toEqual({
      id: "workspace-001",
      userId: "user-123",
    });
  });

  it("should resolve workspace membership from the task id when workspaceId is absent", async () => {
    const taskRecord = {
      getWorkspaceId: () => "workspace-002",
    } as Awaited<ReturnType<ITaskRepository["findByIdAsync"]>>;

    const workspaceService: jest.Mocked<WorkspaceServiceDouble> = {
      validateWorkspaceAsync: jest.fn().mockResolvedValue(true),
      checkUserPermissionAsync: jest.fn().mockResolvedValue(true),
    };
    const taskRepository: jest.Mocked<TaskRepositoryDouble> = {
      findByIdAsync: jest.fn().mockResolvedValue(taskRecord),
    };
    const guard = new WorkspaceValidationGuard(
      workspaceService as unknown as WorkspaceMockService,
      taskRepository as unknown as ITaskRepository,
    );

    const request = {
      headers: { "x-user-name": "Dev User" },
      user: { id: "user-123", name: "Dev User" },
      body: {},
      query: {},
      params: { id: taskId },
    } as unknown as WorkspaceGuardRequest;

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(taskRepository.findByIdAsync).toHaveBeenCalledTimes(1);
    expect(workspaceService.validateWorkspaceAsync).toHaveBeenCalledWith(
      "workspace-002",
      "user-123",
    );
    expect(workspaceService.checkUserPermissionAsync).toHaveBeenCalledWith(
      "workspace-002",
      "user-123",
      "member",
    );
    expect(request.workspace).toEqual({
      id: "workspace-002",
      userId: "user-123",
    });
  });
});

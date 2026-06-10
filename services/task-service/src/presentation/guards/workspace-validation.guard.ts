// src/presentation/guards/workspace-validation.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ITaskRepository as ITaskRepositoryToken } from "../../application/ports/ITaskRepository";
import type { ITaskRepository } from "../../application/ports/ITaskRepository";
import { TaskId } from "../../domain/value-objects/TaskId";
import {
  type IWorkspaceClient,
  WORKSPACE_CLIENT_TOKEN,
} from "../../application/ports/IWorkspaceClient";
import { getHeaderValue } from "../http/request-context";
import type { AppRequest } from "../http/request-context";

interface WorkspaceGuardBody {
  workspaceId?: string;
}

interface WorkspaceGuardQuery extends Record<
  string,
  string | string[] | undefined
> {
  workspaceId?: string;
}

interface WorkspaceGuardParams extends Record<string, string | undefined> {
  taskId?: string;
  id?: string;
}

type WorkspaceGuardRequest = AppRequest<
  WorkspaceGuardParams,
  unknown,
  WorkspaceGuardBody,
  WorkspaceGuardQuery
>;

/**
 * Guard để validate workspace tồn tại và user có quyền truy cập
 * Sẽ kiểm tra:
 * 1. Workspace ID từ request params hoặc body
 * 2. User ID từ headers (x-user-id)
 * 3. Validate workspace tồn tại
 * 4. Validate user là member của workspace
 */
@Injectable()
export class WorkspaceValidationGuard implements CanActivate {
  constructor(
    @Inject(WORKSPACE_CLIENT_TOKEN)
    private readonly workspaceService: IWorkspaceClient,
    @Inject(ITaskRepositoryToken)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WorkspaceGuardRequest>();

    // Lấy userId từ headers (giả định được gửi từ API Gateway sau khi xác thực)
    // Nếu không có, dùng mock user vì User Service chưa implement
    const userId = getHeaderValue(request.headers, "x-user-id") || "user-123";
    const userName =
      getHeaderValue(request.headers, "x-user-name") || "Mock User";

    // Lấy workspaceId từ body (nếu POST/PUT) hoặc query params
    const workspaceId = await this.resolveWorkspaceId(request);

    if (!workspaceId) {
      request.user = { id: userId, name: userName };
      return true;
    }

    let workspaceExists = false;
    let isMember = false;

    try {
      workspaceExists = await this.workspaceService.validateWorkspaceAsync(
        workspaceId,
        userId,
      );
      isMember = await this.workspaceService.checkUserPermissionAsync(
        workspaceId,
        userId,
        "member",
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException({
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message:
          error instanceof Error
            ? error.message
            : "Workspace service validation failed",
      });
    }

    if (!workspaceExists) {
      throw new ForbiddenException(`Workspace ${workspaceId} not found`);
    }

    if (!isMember) {
      throw new ForbiddenException(
        `User ${userId} does not have access to workspace ${workspaceId}`,
      );
    }

    // Attach workspace info vào request object để dùng ở handler
    request.workspace = { id: workspaceId, userId };
    request.user = { id: userId, name: userName };

    return true;
  }

  private async resolveWorkspaceId(
    request: WorkspaceGuardRequest,
  ): Promise<string | undefined> {
    const directWorkspaceId =
      request.body?.workspaceId || request.query?.workspaceId;
    if (typeof directWorkspaceId === "string" && directWorkspaceId.length > 0) {
      return directWorkspaceId;
    }

    const taskId = request.params?.taskId || request.params?.id;
    if (typeof taskId !== "string" || taskId.length === 0) {
      return undefined;
    }

    try {
      const task = await this.taskRepository.findByIdAsync(new TaskId(taskId));
      return task?.getWorkspaceId();
    } catch {
      return undefined;
    }
  }
}

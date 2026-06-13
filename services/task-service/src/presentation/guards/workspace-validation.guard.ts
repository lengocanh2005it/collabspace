// src/presentation/guards/workspace-validation.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ITaskRepository as ITaskRepositoryToken } from "../../application/ports/ITaskRepository";
import type { ITaskRepository } from "../../application/ports/ITaskRepository";
import { TaskId } from "../../domain/value-objects/TaskId";
import {
  type IWorkspaceClient,
  WORKSPACE_CLIENT_TOKEN,
} from "../../application/ports/IWorkspaceClient";
import { meetsWorkspaceRole } from "../../infrastructure/clients/workspace-membership.util";
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
 * 2. User ID from AuthGuard (`request.user`)
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

    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException({
        code: "TOKEN_MISSING",
        message: "Authenticated user is required",
      });
    }

    const userName =
      request.user?.name ??
      getHeaderValue(request.headers, "x-user-name") ??
      "User";

    const workspaceId = await this.resolveWorkspaceId(request);

    if (!workspaceId) {
      request.user = { id: userId, name: userName };
      return true;
    }

    try {
      const membership = await this.workspaceService.getMembershipAsync(
        workspaceId,
        userId,
      );

      if (membership === null) {
        throw new ForbiddenException(`Workspace ${workspaceId} not found`);
      }

      if (
        !membership.isMember ||
        !meetsWorkspaceRole(membership.role, "member")
      ) {
        throw new ForbiddenException(
          `User ${userId} does not have access to workspace ${workspaceId}`,
        );
      }
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof ServiceUnavailableException
      ) {
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

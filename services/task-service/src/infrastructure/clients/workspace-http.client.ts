import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  IWorkspaceClient,
  WorkspaceMember,
} from "../../application/ports/IWorkspaceClient";

type WorkspaceMemberResponse = {
  role: string;
  user_id: string;
};

@Injectable()
export class WorkspaceHttpClient implements IWorkspaceClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>("WORKSPACE_SERVICE_URL") ??
      "http://workspace-service:8080";
    this.timeoutMs = Number(
      this.configService.get<string>("WORKSPACE_SERVICE_TIMEOUT_MS") ?? 3000,
    );
  }

  async validateWorkspaceAsync(
    workspaceId: string,
    userId: string,
  ): Promise<boolean> {
    const response = await this.request(
      `/api/v1/workspaces/${workspaceId}`,
      userId,
    );
    return response.status === 200;
  }

  async checkUserPermissionAsync(
    workspaceId: string,
    userId: string,
    requiredRole: "owner" | "admin" | "member" = "member",
  ): Promise<boolean> {
    const member = await this.getWorkspaceMemberAsync(workspaceId, userId);

    if (!member) {
      return false;
    }

    const roleHierarchy: Record<string, number> = {
      owner: 3,
      admin: 2,
      member: 1,
    };

    return roleHierarchy[member.role] >= roleHierarchy[requiredRole];
  }

  async getWorkspaceMemberAsync(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const response = await this.request(
      `/api/v1/workspaces/${workspaceId}/members`,
      userId,
    );

    if (response.status === 403 || response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new ServiceUnavailableException({
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message: `Workspace service returned ${response.status}`,
      });
    }

    const members = (await response.json()) as WorkspaceMemberResponse[];
    const member = members.find((item) => item.user_id === userId);

    if (!member) {
      return null;
    }

    return {
      role: member.role as WorkspaceMember["role"],
      userId: member.user_id,
    };
  }

  private async request(
    path: string,
    userId: string,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        headers: {
          "X-User-Id": userId,
        },
        signal: controller.signal,
      });
    } catch (error) {
      throw new ServiceUnavailableException({
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message:
          error instanceof Error
            ? error.message
            : "Workspace service request failed",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

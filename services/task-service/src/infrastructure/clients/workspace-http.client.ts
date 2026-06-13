import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { outboundRequestIdHeaders } from "../../common/http/request-id.context";
import type {
  IWorkspaceClient,
  WorkspaceMember,
  WorkspaceMembershipSnapshot,
} from "../../application/ports/IWorkspaceClient";
import { meetsWorkspaceRole } from "./workspace-membership.util";
import { WorkspaceMembershipCacheService } from "../cache/workspace-membership-cache.service";

type WorkspaceMembershipResponse = {
  workspaceId: string;
  userId: string;
  isMember: boolean;
  role: string | null;
};

@Injectable()
export class WorkspaceHttpClient implements IWorkspaceClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly internalToken: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly membershipCache: WorkspaceMembershipCacheService,
  ) {
    this.baseUrl =
      this.configService.get<string>("WORKSPACE_SERVICE_URL") ??
      "http://workspace-service:8080";
    this.timeoutMs = Number(
      this.configService.get<string>("WORKSPACE_SERVICE_TIMEOUT_MS") ?? 3000,
    );
    this.internalToken = this.configService
      .get<string>("INTERNAL_SERVICE_TOKEN")
      ?.trim();
  }

  async getMembershipAsync(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipSnapshot | null> {
    const cached = this.membershipCache.read(workspaceId, userId);
    if (cached !== undefined) {
      return cached;
    }

    const membership = await this.fetchMembership(workspaceId, userId);

    if (!membership) {
      this.membershipCache.write(workspaceId, userId, null);
      return null;
    }

    const snapshot = {
      isMember: membership.isMember,
      role: membership.role as WorkspaceMember["role"] | null,
    };
    this.membershipCache.write(workspaceId, userId, snapshot);
    return snapshot;
  }

  async validateWorkspaceAsync(
    workspaceId: string,
    userId: string,
  ): Promise<boolean> {
    const membership = await this.getMembershipAsync(workspaceId, userId);
    return membership?.isMember === true;
  }

  async checkUserPermissionAsync(
    workspaceId: string,
    userId: string,
    requiredRole: "owner" | "admin" | "member" = "member",
  ): Promise<boolean> {
    const membership = await this.getMembershipAsync(workspaceId, userId);

    if (!membership?.isMember) {
      return false;
    }

    return meetsWorkspaceRole(membership.role, requiredRole);
  }

  async getWorkspaceMemberAsync(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const membership = await this.getMembershipAsync(workspaceId, userId);

    if (!membership?.isMember || !membership.role) {
      return null;
    }

    return {
      role: membership.role,
      userId,
    };
  }

  private isInternalAccessEnabled(): boolean {
    return (
      Boolean(this.internalToken) || process.env.NODE_ENV === "development"
    );
  }

  private async fetchMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipResponse | null> {
    if (!this.isInternalAccessEnabled()) {
      throw new ServiceUnavailableException({
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message:
          "INTERNAL_SERVICE_TOKEN is required for workspace membership checks",
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      ...outboundRequestIdHeaders(),
    };

    if (this.internalToken) {
      headers["X-Internal-Service-Token"] = this.internalToken;
    }

    const path =
      `/api/v1/workspaces/internal/${encodeURIComponent(workspaceId)}` +
      `/membership?userId=${encodeURIComponent(userId)}`;

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers,
        signal: controller.signal,
      });

      if (response.status === 404) {
        return null;
      }

      if (response.status === 401 || response.status === 403) {
        throw new ServiceUnavailableException({
          code: "WORKSPACE_SERVICE_UNAVAILABLE",
          message: `Workspace internal access denied (${response.status})`,
        });
      }

      if (!response.ok) {
        throw new ServiceUnavailableException({
          code: "WORKSPACE_SERVICE_UNAVAILABLE",
          message: `Workspace service returned ${response.status}`,
        });
      }

      return (await response.json()) as WorkspaceMembershipResponse;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

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

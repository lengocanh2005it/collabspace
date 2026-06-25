import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  buildOutboundServiceAuthHeaders,
  isOutboundServiceAuthConfigured,
  parseWorkspaceRole,
  retryAsync,
  SERVICE_IDS,
  SERVICE_SCOPES,
  type WorkspaceRole,
} from "@collabspace/shared";
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
  private readonly retryAttempts: number;
  private readonly retryDelayMs: number;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly serviceJwtSecret: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly membershipCache: WorkspaceMembershipCacheService,
  ) {
    this.baseUrl =
      this.configService.get<string>("WORKSPACE_SERVICE_URL") ?? "http://workspace-service:8080";
    this.timeoutMs = Number(this.configService.get<string>("WORKSPACE_SERVICE_TIMEOUT_MS") ?? 3000);
    this.retryAttempts = Math.max(
      1,
      Number(this.configService.get<string>("WORKSPACE_SERVICE_RETRY_ATTEMPTS") ?? 2),
    );
    this.retryDelayMs = Math.max(
      0,
      Number(this.configService.get<string>("WORKSPACE_SERVICE_RETRY_DELAY_MS") ?? 75),
    );
    this.circuitBreaker = new CircuitBreaker("workspace-service", {
      failureThreshold: Math.max(
        1,
        Number(
          this.configService.get<string>("WORKSPACE_SERVICE_CIRCUIT_BREAKER_FAILURE_THRESHOLD") ??
            5,
        ),
      ),
      resetTimeoutMs: Math.max(
        1,
        Number(
          this.configService.get<string>("WORKSPACE_SERVICE_CIRCUIT_BREAKER_RESET_TIMEOUT_MS") ??
            30_000,
        ),
      ),
    });
    this.serviceJwtSecret = this.configService.get<string>("SERVICE_JWT_SECRET")?.trim();
  }

  async getMembershipAsync(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipSnapshot | null> {
    const cached = await this.membershipCache.read(workspaceId, userId);
    if (cached !== undefined) {
      return cached;
    }

    const membership = await this.fetchMembership(workspaceId, userId);

    if (!membership) {
      await this.membershipCache.write(workspaceId, userId, null);
      return null;
    }

    const snapshot = {
      isMember: membership.isMember,
      role: parseWorkspaceRole(membership.role),
    };
    await this.membershipCache.write(workspaceId, userId, snapshot);
    return snapshot;
  }

  async validateWorkspaceAsync(workspaceId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembershipAsync(workspaceId, userId);
    return membership?.isMember === true;
  }

  async checkUserPermissionAsync(
    workspaceId: string,
    userId: string,
    requiredRole: WorkspaceRole = "member",
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
    return isOutboundServiceAuthConfigured({
      serviceJwtSecret: this.serviceJwtSecret,
      nodeEnv: process.env.NODE_ENV,
    });
  }

  private buildAuthHeaders(): Record<string, string> {
    return buildOutboundServiceAuthHeaders({
      iss: SERVICE_IDS.TASK,
      aud: SERVICE_IDS.WORKSPACE,
      scope: [SERVICE_SCOPES.WORKSPACE_MEMBERSHIP_READ],
      serviceJwtSecret: this.serviceJwtSecret,
    }).headers;
  }

  private async fetchMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipResponse | null> {
    if (!this.isInternalAccessEnabled()) {
      throw new ServiceUnavailableException({
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message: "SERVICE_JWT_SECRET is required for workspace membership checks",
      });
    }

    const headers: Record<string, string> = {
      ...outboundRequestIdHeaders(),
      ...this.buildAuthHeaders(),
    };

    const path =
      `/api/v1/workspaces/internal/${encodeURIComponent(workspaceId)}` +
      `/membership?userId=${encodeURIComponent(userId)}`;

    try {
      const response = await this.circuitBreaker.execute(async () => {
        const result = await retryAsync(
          () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
            return fetch(`${this.baseUrl}${path}`, {
              headers,
              signal: controller.signal,
            }).finally(() => clearTimeout(timeout));
          },
          {
            maxAttempts: this.retryAttempts,
            delayMs: this.retryDelayMs,
            shouldRetryResult: (result) => result.status >= 500,
          },
        );

        if (result.status >= 500) {
          throw new Error(`Workspace service returned ${result.status}`);
        }

        return result;
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

      const message =
        error instanceof CircuitBreakerOpenError
          ? "Workspace service circuit breaker is open"
          : error instanceof Error
            ? error.message
            : "Workspace service request failed";

      throw new ServiceUnavailableException({
        code: "WORKSPACE_SERVICE_UNAVAILABLE",
        message,
      });
    }
  }
}

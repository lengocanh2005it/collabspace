import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  buildOutboundServiceAuthHeaders,
  isOutboundServiceAuthConfigured,
  SERVICE_IDS,
  SERVICE_SCOPES,
} from "@collabspace/shared";
import { outboundRequestIdHeaders } from "../../common/http/request-id.context";

export type RemoteUserReplica = {
  userId: string;
  email: string;
  username: string | null;
  fullName: string;
  displayName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
};

export type UserReplicaLookupRequest = {
  userIds?: string[];
  username?: string;
};

@Injectable()
export class UserProfileHttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly serviceJwtSecret: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>("USER_SERVICE_URL") ??
      "http://user-service:3000";
    this.timeoutMs = Number(
      this.configService.get<string>("USER_SERVICE_TIMEOUT_MS") ?? 3000,
    );
    this.serviceJwtSecret = this.configService
      .get<string>("SERVICE_JWT_SECRET")
      ?.trim();
  }

  isFallbackEnabled(): boolean {
    if (
      this.configService.get<string>("USER_REPLICA_FALLBACK_ENABLED") ===
      "false"
    ) {
      return false;
    }

    return (
      Boolean(this.baseUrl) &&
      isOutboundServiceAuthConfigured({
        serviceJwtSecret: this.serviceJwtSecret,
        nodeEnv: process.env.NODE_ENV,
      })
    );
  }

  async lookupReplicas(
    request: UserReplicaLookupRequest,
  ): Promise<RemoteUserReplica[]> {
    if (!this.isFallbackEnabled()) {
      return [];
    }

    const response = await this.post(
      "/api/v1/users/internal/replicas",
      request,
    );

    if (!response.ok) {
      throw new ServiceUnavailableException({
        code: "USER_SERVICE_UNAVAILABLE",
        message: `User service returned ${response.status} during replica lookup`,
      });
    }

    return (await response.json()) as RemoteUserReplica[];
  }

  private buildAuthHeaders(): Record<string, string> {
    return buildOutboundServiceAuthHeaders({
      iss: SERVICE_IDS.TASK,
      aud: SERVICE_IDS.USER,
      scope: [SERVICE_SCOPES.USER_REPLICAS_READ],
      serviceJwtSecret: this.serviceJwtSecret,
    }).headers;
  }

  private async post(path: string, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...outboundRequestIdHeaders(),
      ...this.buildAuthHeaders(),
    };

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      throw new ServiceUnavailableException({
        code: "USER_SERVICE_UNAVAILABLE",
        message:
          error instanceof Error
            ? error.message
            : "User service replica lookup failed",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

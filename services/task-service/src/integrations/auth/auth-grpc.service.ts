import {
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { ClientGrpc } from "@nestjs/microservices";
import { TimeoutError, firstValueFrom, type Observable, timeout } from "rxjs";
import { createHash } from "node:crypto";

export const AUTH_GRPC_CLIENT = "AUTH_GRPC_CLIENT";

type VerifyAccessTokenRequest = {
  authorization: string;
};

type VerifyAccessTokenResponse = {
  authenticated?: boolean;
  emailVerified?: boolean;
  permissions?: string[];
  role?: string;
  roles?: string[];
  userId?: string;
  workspaceId?: string;
};

type VerifyAccessTokenLiteResponse = {
  authenticated?: boolean;
  emailVerified?: boolean;
  role?: string;
  roles?: string[];
  userId?: string;
  workspaceId?: string;
};

type AuthGrpcClient = {
  verifyAccessToken(request: VerifyAccessTokenRequest): Observable<VerifyAccessTokenResponse>;
  verifyAccessTokenLite(
    request: VerifyAccessTokenRequest,
  ): Observable<VerifyAccessTokenLiteResponse>;
};

export type AuthIdentity = {
  emailVerified?: boolean;
  permissions?: string[];
  role?: string;
  roles?: string[];
  userId: string;
  workspaceId?: string;
};

export type AuthLiteIdentity = {
  emailVerified?: boolean;
  role?: string;
  roles?: string[];
  userId: string;
  workspaceId?: string;
};

const LITE_CACHE_TTL_MS = 5_000;
const LITE_CACHE_MAX = 2_000;

type LiteCacheEntry = { identity: AuthLiteIdentity; expiresAt: number };

@Injectable()
export class AuthGrpcService implements OnModuleInit {
  private readonly logger = new Logger(AuthGrpcService.name);
  private readonly client: ClientGrpc;
  private authService?: AuthGrpcClient;
  private readonly liteCache = new Map<string, LiteCacheEntry>();

  constructor(@Inject(AUTH_GRPC_CLIENT) client: unknown) {
    this.client = client as ClientGrpc;
  }

  onModuleInit(): void {
    this.authService = this.client.getService<AuthGrpcClient>("AuthService");
  }

  async verifyAccessTokenLite(authorizationHeader?: string): Promise<AuthLiteIdentity> {
    const token = authorizationHeader?.trim();
    if (token) {
      const cacheKey = createHash("sha256").update(token).digest("hex");
      const hit = this.liteCache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        return hit.identity;
      }

      const response = await this.invokeVerify(
        (authorization) => this.authService!.verifyAccessTokenLite({ authorization }),
        token,
        "VerifyAccessTokenLite",
      );

      const identity: AuthLiteIdentity = {
        emailVerified: response.emailVerified,
        role: response.role,
        roles: response.roles ?? [],
        userId: response.userId!,
        workspaceId: response.workspaceId,
      };

      if (this.liteCache.size >= LITE_CACHE_MAX) {
        this.liteCache.delete(this.liteCache.keys().next().value!);
      }
      this.liteCache.set(cacheKey, {
        identity,
        expiresAt: Date.now() + LITE_CACHE_TTL_MS,
      });
      return identity;
    }

    const response = await this.invokeVerify(
      (authorization) => this.authService!.verifyAccessTokenLite({ authorization }),
      authorizationHeader,
      "VerifyAccessTokenLite",
    );

    return {
      emailVerified: response.emailVerified,
      role: response.role,
      roles: response.roles ?? [],
      userId: response.userId!,
      workspaceId: response.workspaceId,
    };
  }

  async verifyAccessToken(authorizationHeader?: string): Promise<AuthIdentity> {
    const response = await this.invokeVerify(
      (authorization) => this.authService!.verifyAccessToken({ authorization }),
      authorizationHeader,
      "VerifyAccessToken",
    );

    return {
      emailVerified: response.emailVerified,
      permissions: response.permissions ?? [],
      role: response.role,
      roles: response.roles ?? [],
      userId: response.userId!,
      workspaceId: response.workspaceId,
    };
  }

  private async invokeVerify<T extends VerifyAccessTokenResponse>(
    call: (authorization: string) => Observable<T>,
    authorizationHeader: string | undefined,
    rpcLabel: string,
  ): Promise<T> {
    const authorization = authorizationHeader?.trim();

    if (!authorization) {
      throw new UnauthorizedException({
        code: "TOKEN_MISSING",
        message: "Authorization header is required",
      });
    }

    if (!this.authService) {
      throw new ServiceUnavailableException({
        code: "AUTH_SERVICE_GRPC_UNAVAILABLE",
        message: "Auth gRPC client is not initialized",
      });
    }

    const timeoutMs = this.getGrpcTimeoutMs();

    try {
      const response = await firstValueFrom(
        call(authorization).pipe(timeout({ first: timeoutMs })),
      );

      if (!response.authenticated || !response.userId) {
        throw new UnauthorizedException({
          code: "TOKEN_INVALID",
          message: "Access token is invalid",
        });
      }

      return response;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (this.isTimeoutError(error)) {
        this.logger.warn(`AuthService.${rpcLabel} timed out after ${timeoutMs}ms`);
        throw new ServiceUnavailableException({
          code: "AUTH_SERVICE_GRPC_TIMEOUT",
          message: `Auth gRPC verification timed out after ${timeoutMs}ms`,
        });
      }

      if (this.isUnauthenticatedError(error)) {
        const message = this.extractErrorMessage(error, "Access token is invalid");
        throw new UnauthorizedException({
          code: "TOKEN_INVALID",
          message,
        });
      }

      const message = this.extractErrorMessage(error, "Auth gRPC verification request failed");
      this.logger.warn(`AuthService.${rpcLabel} failed: ${message}`);
      throw new ServiceUnavailableException({
        code: "AUTH_SERVICE_GRPC_REQUEST_FAILED",
        message,
      });
    }
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (
      typeof error === "object" &&
      error &&
      "details" in error &&
      typeof (error as { details?: unknown }).details === "string"
    ) {
      return (error as { details: string }).details;
    }

    return fallback;
  }

  private getGrpcTimeoutMs(): number {
    const timeoutMs = Number(process.env.AUTH_SERVICE_GRPC_TIMEOUT_MS ?? 3000);
    return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 3000;
  }

  private isTimeoutError(error: unknown): boolean {
    return error instanceof TimeoutError;
  }

  private isUnauthenticatedError(error: unknown): boolean {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: unknown }).code === 16
    ) {
      return true;
    }

    const message = this.extractErrorMessage(error, "").toLowerCase();
    return message.includes("unauthenticated");
  }
}

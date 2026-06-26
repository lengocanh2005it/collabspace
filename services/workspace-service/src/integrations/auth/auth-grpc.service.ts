import {
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { createHash } from 'node:crypto';
import { TimeoutError, firstValueFrom, type Observable, timeout } from 'rxjs';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../infrastructure/cache/redis-client.token';

export const AUTH_GRPC_CLIENT = 'AUTH_GRPC_CLIENT';

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

type AuthenticatedVerifyAccessTokenResponse<T extends VerifyAccessTokenResponse> = T & {
  userId: string;
};

type AuthGrpcClient = {
  verifyAccessToken(request: VerifyAccessTokenRequest): Observable<VerifyAccessTokenResponse>;
  verifyAccessTokenLite(
    request: VerifyAccessTokenRequest,
  ): Observable<VerifyAccessTokenLiteResponse>;
};

type ReadyGrpcClient = {
  waitForReady(deadline: number, callback: (error?: Error | null) => void): void;
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

@Injectable()
export class AuthGrpcService implements OnModuleInit {
  private readonly logger = new Logger(AuthGrpcService.name);
  private readonly client: ClientGrpc;
  private authClient?: ReadyGrpcClient;
  private authService?: AuthGrpcClient;

  constructor(
    @Inject(AUTH_GRPC_CLIENT) client: unknown,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null = null,
  ) {
    this.client = client as ClientGrpc;
  }

  onModuleInit(): void {
    this.authService = this.client.getService<AuthGrpcClient>('AuthService');
    this.authClient = this.client.getClientByServiceName<ReadyGrpcClient>('AuthService');
  }

  async ping(): Promise<void> {
    if (!this.authClient) {
      throw new ServiceUnavailableException({
        code: 'AUTH_SERVICE_GRPC_UNAVAILABLE',
        message: 'Auth gRPC client is not initialized',
      });
    }

    const timeoutMs = this.getGrpcTimeoutMs();

    try {
      await new Promise<void>((resolve, reject) => {
        this.authClient?.waitForReady(Date.now() + timeoutMs, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    } catch (error) {
      const message = this.extractErrorMessage(error, 'Auth gRPC readiness check failed');

      if (message.toLowerCase().includes('deadline')) {
        throw new ServiceUnavailableException({
          code: 'AUTH_SERVICE_GRPC_TIMEOUT',
          message: `Auth gRPC readiness timed out after ${timeoutMs}ms`,
        });
      }

      throw new ServiceUnavailableException({
        code: 'AUTH_SERVICE_GRPC_REQUEST_FAILED',
        message,
      });
    }
  }

  async verifyAccessTokenLite(authorizationHeader?: string): Promise<AuthLiteIdentity> {
    const authorization = authorizationHeader?.trim();

    if (!authorization) {
      throw new UnauthorizedException({
        code: 'TOKEN_MISSING',
        message: 'Authorization header is required',
      });
    }

    const cached = await this.getCachedIdentity(authorization);
    if (cached) return cached;

    const authService = this.getAuthServiceClient();
    const response = await this.invokeVerify(
      (auth) => authService.verifyAccessTokenLite({ authorization: auth }),
      authorization,
      'VerifyAccessTokenLite',
    );

    const identity: AuthLiteIdentity = {
      emailVerified: response.emailVerified,
      role: response.role,
      roles: response.roles ?? [],
      userId: response.userId,
      workspaceId: response.workspaceId,
    };

    await this.setCachedIdentity(authorization, identity);
    return identity;
  }

  async verifyAccessToken(authorizationHeader?: string): Promise<AuthIdentity> {
    const authService = this.getAuthServiceClient();
    const response = await this.invokeVerify(
      (authorization) => authService.verifyAccessToken({ authorization }),
      authorizationHeader,
      'VerifyAccessToken',
    );

    return {
      emailVerified: response.emailVerified,
      permissions: response.permissions ?? [],
      role: response.role,
      roles: response.roles ?? [],
      userId: response.userId,
      workspaceId: response.workspaceId,
    };
  }

  private getAuthServiceClient(): AuthGrpcClient {
    if (!this.authService) {
      throw new ServiceUnavailableException({
        code: 'AUTH_SERVICE_GRPC_UNAVAILABLE',
        message: 'Auth gRPC client is not initialized',
      });
    }

    return this.authService;
  }

  private async invokeVerify<T extends VerifyAccessTokenResponse>(
    call: (authorization: string) => Observable<T>,
    authorizationHeader: string | undefined,
    rpcLabel: string,
  ): Promise<AuthenticatedVerifyAccessTokenResponse<T>> {
    const authorization = authorizationHeader?.trim();

    if (!authorization) {
      throw new UnauthorizedException({
        code: 'TOKEN_MISSING',
        message: 'Authorization header is required',
      });
    }

    if (!this.authService) {
      throw new ServiceUnavailableException({
        code: 'AUTH_SERVICE_GRPC_UNAVAILABLE',
        message: 'Auth gRPC client is not initialized',
      });
    }

    const timeoutMs = this.getGrpcTimeoutMs();

    try {
      const response = await firstValueFrom(
        call(authorization).pipe(timeout({ first: timeoutMs })),
      );

      if (!response.authenticated || !response.userId) {
        throw new UnauthorizedException({
          code: 'TOKEN_INVALID',
          message: 'Access token is invalid',
        });
      }

      return response as AuthenticatedVerifyAccessTokenResponse<T>;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (this.isTimeoutError(error)) {
        this.logger.warn(`AuthService.${rpcLabel} timed out after ${timeoutMs}ms`);
        throw new ServiceUnavailableException({
          code: 'AUTH_SERVICE_GRPC_TIMEOUT',
          message: `Auth gRPC verification timed out after ${timeoutMs}ms`,
        });
      }

      if (this.isUnauthenticatedError(error)) {
        const message = this.extractErrorMessage(error, 'Access token is invalid');
        throw new UnauthorizedException({
          code: 'TOKEN_INVALID',
          message,
        });
      }

      const message = this.extractErrorMessage(error, 'Auth gRPC verification request failed');
      this.logger.warn(`AuthService.${rpcLabel} failed: ${message}`);
      throw new ServiceUnavailableException({
        code: 'AUTH_SERVICE_GRPC_REQUEST_FAILED',
        message,
      });
    }
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (
      typeof error === 'object' &&
      error &&
      'details' in error &&
      typeof (error as { details?: unknown }).details === 'string'
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

  private tokenCacheKey(authorization: string): string {
    const hash = createHash('sha256').update(authorization).digest('hex').slice(0, 32);
    return `auth-token:${hash}`;
  }

  private tokenCacheTtl(): number {
    const ttl = Number(process.env.AUTH_TOKEN_CACHE_TTL_SECONDS ?? 60);
    return Number.isFinite(ttl) && ttl > 0 ? ttl : 60;
  }

  private async getCachedIdentity(authorization: string): Promise<AuthLiteIdentity | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(this.tokenCacheKey(authorization));
      if (!raw) return null;
      return JSON.parse(raw) as AuthLiteIdentity;
    } catch {
      return null;
    }
  }

  private async setCachedIdentity(
    authorization: string,
    identity: AuthLiteIdentity,
  ): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(
        this.tokenCacheKey(authorization),
        this.tokenCacheTtl(),
        JSON.stringify(identity),
      );
    } catch {
      // cache write failure is non-fatal
    }
  }

  private isUnauthenticatedError(error: unknown): boolean {
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      (error as { code?: unknown }).code === 16
    ) {
      return true;
    }

    const message = this.extractErrorMessage(error, '').toLowerCase();
    return message.includes('unauthenticated');
  }
}

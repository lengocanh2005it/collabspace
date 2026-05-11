import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { TimeoutError, firstValueFrom, Observable, timeout } from 'rxjs';

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

type AuthGrpcClient = {
  verifyAccessToken(
    request: VerifyAccessTokenRequest,
  ): Observable<VerifyAccessTokenResponse>;
};

type ReadyGrpcClient = {
  waitForReady(
    deadline: number,
    callback: (error?: Error | null) => void,
  ): void;
};

export type AuthIdentity = {
  emailVerified?: boolean;
  permissions?: string[];
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

  constructor(@Inject(AUTH_GRPC_CLIENT) client: unknown) {
    this.client = client as ClientGrpc;
  }

  onModuleInit(): void {
    this.authService = this.client.getService<AuthGrpcClient>('AuthService');
    this.authClient = this.client.getClientByServiceName<ReadyGrpcClient>(
      'AuthService',
    );
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
      const message = this.extractErrorMessage(
        error,
        'Auth gRPC readiness check failed',
      );

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

  async verifyAccessToken(authorizationHeader?: string): Promise<AuthIdentity> {
    const authorization = authorizationHeader?.trim();

    if (!authorization) {
      throw new UnauthorizedException({
        code: 'AUTHORIZATION_HEADER_MISSING',
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
        this.authService
          .verifyAccessToken({ authorization })
          .pipe(timeout({ first: timeoutMs })),
      );

      if (!response.authenticated || !response.userId) {
        throw new UnauthorizedException({
          code: 'TOKEN_INVALID',
          message: 'Access token is invalid',
        });
      }

      return {
        emailVerified: response.emailVerified,
        permissions: response.permissions ?? [],
        role: response.role,
        roles: response.roles ?? [],
        userId: response.userId,
        workspaceId: response.workspaceId,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (this.isTimeoutError(error)) {
        this.logger.warn(
          `AuthService.VerifyAccessToken timed out after ${timeoutMs}ms`,
        );
        throw new ServiceUnavailableException({
          code: 'AUTH_SERVICE_GRPC_TIMEOUT',
          message: `Auth gRPC verification timed out after ${timeoutMs}ms`,
        });
      }

      if (this.isUnauthenticatedError(error)) {
        const message = this.extractErrorMessage(
          error,
          'Access token is invalid',
        );
        throw new UnauthorizedException({
          code: 'TOKEN_INVALID',
          message,
        });
      }

      const message = this.extractErrorMessage(
        error,
        'Auth gRPC verification request failed',
      );
      this.logger.warn(`AuthService.VerifyAccessToken failed: ${message}`);
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

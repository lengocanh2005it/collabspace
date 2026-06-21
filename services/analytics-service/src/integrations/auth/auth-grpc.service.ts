import {
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { TimeoutError, firstValueFrom, type Observable, timeout } from 'rxjs';

export const AUTH_GRPC_CLIENT = 'AUTH_GRPC_CLIENT';

type VerifyAccessTokenRequest = { authorization: string };

type VerifyAccessTokenResponse = {
  authenticated?: boolean;
  emailVerified?: boolean;
  permissions?: string[];
  role?: string;
  roles?: string[];
  userId?: string;
};

type AuthGrpcClient = {
  verifyAccessToken(request: VerifyAccessTokenRequest): Observable<VerifyAccessTokenResponse>;
};

export type AuthIdentity = {
  emailVerified?: boolean;
  permissions?: string[];
  role?: string;
  roles?: string[];
  userId: string;
};

@Injectable()
export class AuthGrpcService implements OnModuleInit {
  private readonly logger = new Logger(AuthGrpcService.name);
  private readonly client: ClientGrpc;
  private authService?: AuthGrpcClient;

  constructor(@Inject(AUTH_GRPC_CLIENT) client: unknown) {
    this.client = client as ClientGrpc;
  }

  onModuleInit(): void {
    this.authService = this.client.getService<AuthGrpcClient>('AuthService');
  }

  async verifyAccessToken(authorizationHeader?: string): Promise<AuthIdentity> {
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

    const timeoutMs = Number(process.env.AUTH_SERVICE_GRPC_TIMEOUT_MS ?? 3000);

    try {
      const response = await firstValueFrom(
        this.authService.verifyAccessToken({ authorization }).pipe(timeout({ first: timeoutMs })),
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
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

      if (error instanceof TimeoutError) {
        this.logger.warn(`AuthService.VerifyAccessToken timed out after ${timeoutMs}ms`);
        throw new ServiceUnavailableException({
          code: 'AUTH_SERVICE_GRPC_TIMEOUT',
          message: `Auth gRPC timed out after ${timeoutMs}ms`,
        });
      }

      const message = error instanceof Error ? error.message : 'Auth gRPC request failed';
      this.logger.warn(`AuthService.VerifyAccessToken failed: ${message}`);
      throw new ServiceUnavailableException({ code: 'AUTH_SERVICE_GRPC_REQUEST_FAILED', message });
    }
  }
}

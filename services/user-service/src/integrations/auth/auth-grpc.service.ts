import {
  Inject,
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

export const AUTH_GRPC_CLIENT = 'AUTH_GRPC_CLIENT';

type VerifyAccessTokenRequest = {
  authorization: string;
};

type VerifyAccessTokenResponse = {
  authenticated?: boolean;
  role?: string;
  userId?: string;
  workspaceId?: string;
};

type AuthGrpcClient = {
  verifyAccessToken(
    request: VerifyAccessTokenRequest,
  ): Observable<VerifyAccessTokenResponse>;
};

export type AuthIdentity = {
  role?: string;
  userId: string;
  workspaceId?: string;
};

@Injectable()
export class AuthGrpcService implements OnModuleInit {
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

    try {
      const response = await firstValueFrom(
        this.authService.verifyAccessToken({ authorization }),
      );

      if (!response.authenticated || !response.userId) {
        throw new UnauthorizedException({
          code: 'TOKEN_INVALID',
          message: 'Access token is invalid',
        });
      }

      return {
        role: response.role,
        userId: response.userId,
        workspaceId: response.workspaceId,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('unauthenticated')
      ) {
        throw new UnauthorizedException({
          code: 'TOKEN_INVALID',
          message: error.message,
        });
      }

      throw new ServiceUnavailableException({
        code: 'AUTH_SERVICE_GRPC_REQUEST_FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'Auth gRPC verification request failed',
      });
    }
  }
}

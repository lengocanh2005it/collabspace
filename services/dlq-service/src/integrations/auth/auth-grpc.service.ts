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

type AuthServiceGrpc = {
  verifyAccessToken(request: VerifyAccessTokenRequest): Observable<VerifyAccessTokenResponse>;
};

@Injectable()
export class AuthGrpcService implements OnModuleInit {
  private readonly logger = new Logger(AuthGrpcService.name);
  private authService!: AuthServiceGrpc;

  constructor(@Inject(AUTH_GRPC_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.authService = this.client.getService<AuthServiceGrpc>('AuthService');
  }

  async verifyAccessToken(
    authorization?: string,
  ): Promise<VerifyAccessTokenResponse & { userId: string }> {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'TOKEN_MISSING',
        message: 'Authorization header is required',
      });
    }
    try {
      const response = await firstValueFrom(
        this.authService.verifyAccessToken({ authorization: authorization }).pipe(timeout(5000)),
      );

      if (!response.authenticated || !response.userId) {
        throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Token is not valid' });
      }

      return response as VerifyAccessTokenResponse & { userId: string };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof TimeoutError) {
        this.logger.warn('Auth gRPC timeout');
        throw new ServiceUnavailableException({
          code: 'AUTH_UNAVAILABLE',
          message: 'Auth service unavailable',
        });
      }
      this.logger.error(`Auth gRPC error: ${error instanceof Error ? error.message : 'unknown'}`);
      throw new ServiceUnavailableException({
        code: 'AUTH_UNAVAILABLE',
        message: 'Auth service unavailable',
      });
    }
  }
}

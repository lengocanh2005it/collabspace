import { Controller, UnauthorizedException } from '@nestjs/common';
import { RpcException, GrpcMethod } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { from, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import type { auth } from '@/generated/proto/auth';
import { VerifyAccessTokenLiteUseCase } from '@/application/use-cases/verify-access-token-lite.use-case';
import { VerifyAccessTokenUseCase } from '@/application/use-cases/verify-access-token.use-case';

@Controller()
export class AuthGrpcController implements auth.AuthService {
  constructor(
    private readonly verifyAccessTokenUseCase: VerifyAccessTokenUseCase,
    private readonly verifyAccessTokenLiteUseCase: VerifyAccessTokenLiteUseCase,
  ) {}

  @GrpcMethod('AuthService', 'VerifyAccessToken')
  verifyAccessToken(
    request: auth.VerifyAccessTokenRequest,
  ): Observable<auth.VerifyAccessTokenResponse> {
    return from(
      this.verifyAccessTokenUseCase.execute(request.authorization),
    ).pipe(
      map((identity) => ({
        authenticated: true,
        emailVerified: identity.emailVerified,
        permissions: identity.permissions,
        role: identity.role,
        roles: identity.roles,
        userId: identity.userId,
        workspaceId: identity.workspaceId,
      })),
      catchError((error: unknown) => {
        throw this.mapRpcError(error);
      }),
    );
  }

  @GrpcMethod('AuthService', 'VerifyAccessTokenLite')
  verifyAccessTokenLite(
    request: auth.VerifyAccessTokenLiteRequest,
  ): Observable<auth.VerifyAccessTokenLiteResponse> {
    return from(
      this.verifyAccessTokenLiteUseCase.execute(request.authorization),
    ).pipe(
      map((identity) => ({
        authenticated: true,
        emailVerified: identity.emailVerified,
        role: identity.role,
        roles: identity.roles,
        userId: identity.userId,
        workspaceId: identity.workspaceId,
      })),
      catchError((error: unknown) => {
        throw this.mapRpcError(error);
      }),
    );
  }

  private mapRpcError(error: unknown): RpcException {
    if (error instanceof UnauthorizedException) {
      const response = error.getResponse();
      const details =
        typeof response === 'object' && response
          ? response
          : {
              message: error.message,
            };

      return new RpcException({
        code: status.UNAUTHENTICATED,
        ...details,
      });
    }

    if (error instanceof Error) {
      return new RpcException({
        code: status.INTERNAL,
        message: error.message,
      });
    }

    return new RpcException({
      code: status.INTERNAL,
      message: 'Internal gRPC error',
    });
  }
}

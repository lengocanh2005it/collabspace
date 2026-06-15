import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthGrpcService } from '../../../integrations/auth/auth-grpc.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authGrpcService: AuthGrpcService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    if (authorization?.trim()) {
      const identity = await this.authGrpcService.verifyAccessTokenLite(authorization);
      // @ts-expect-error inject authenticated user
      request.user = { id: identity.userId };
      return true;
    }

    if (process.env.ALLOW_DEV_IDENTITY_HEADERS === 'true') {
      const userId = request.headers['x-user-id'];
      if (typeof userId === 'string' && userId.trim()) {
        // @ts-expect-error dev fallback user
        request.user = { id: userId.trim() };
        return true;
      }
    }

    throw new UnauthorizedException({
      code: 'TOKEN_MISSING',
      message: 'Authorization header is required',
    });
  }
}

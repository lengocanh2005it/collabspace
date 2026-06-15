import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class UserIdGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.headers['x-user-id'];

    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }

    // @ts-expect-error injecting user
    request.user = { id: userId as string };
    return true;
  }
}

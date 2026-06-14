import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { isPlatformAdmin } from '@collabspace/shared';
import type { Request } from 'express';
import { JwtTokenService } from '@/application/services/jwt-token.service';

export type AdminAuthenticatedRequest = Request & {
  adminIdentity: {
    permissions: string[];
    role?: string;
    roles: string[];
    userId: string;
  };
};

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly jwtTokenService: JwtTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    const { user } = await this.jwtTokenService.resolveVerifiedUserContext(
      request.header('authorization'),
    );
    const identity = {
      permissions: user.permissions,
      role: user.role,
      roles: user.roles,
      userId: user.userId,
    };
    if (!isPlatformAdmin(identity)) {
      throw new ForbiddenException({
        code: 'PLATFORM_ADMIN_REQUIRED',
        message: 'Platform administrator role is required',
      });
    }
    request.adminIdentity = identity;
    return true;
  }
}

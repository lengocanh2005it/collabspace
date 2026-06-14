import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  hasPlatformPermission,
  isPlatformAdmin,
} from '@collabspace/shared';
import type { Request } from 'express';
import {
  REQUIRE_PERMISSION_KEY,
} from '../constants';
import { PLATFORM_IDENTITY_RESOLVER } from '../tokens';
import type {
  AdminAuthenticatedRequest,
  PlatformIdentityResolver,
} from '../types';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PLATFORM_IDENTITY_RESOLVER)
    private readonly identityResolver: PlatformIdentityResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AdminAuthenticatedRequest>();
    const identity = await this.identityResolver.resolve(request);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions?.length) {
      const allowed =
        isPlatformAdmin(identity) ||
        requiredPermissions.some((permission) =>
          hasPlatformPermission(identity, permission),
        );
      if (!allowed) {
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          message: 'Required permission is missing',
        });
      }
    } else if (!isPlatformAdmin(identity)) {
      throw new ForbiddenException({
        code: 'PLATFORM_ADMIN_REQUIRED',
        message: 'Platform administrator role is required',
      });
    }

    request.adminIdentity = identity;
    return true;
  }
}

export function createBearerIdentityResolver(
  verify: (authorization?: string) => Promise<{
    permissions?: string[];
    role?: string;
    roles?: string[];
    userId: string;
  }>,
): PlatformIdentityResolver {
  return {
    resolve: async (request: Request) => {
      const identity = await verify(request.header('authorization'));
      return {
        permissions: identity.permissions,
        role: identity.role,
        roles: identity.roles,
        userId: identity.userId,
      };
    },
  };
}

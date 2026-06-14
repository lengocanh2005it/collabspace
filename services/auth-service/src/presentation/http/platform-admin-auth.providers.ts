import {
  PLATFORM_IDENTITY_RESOLVER,
  PlatformAdminGuard,
  createBearerIdentityResolver,
} from '@collabspace/nest-auth';
import { JwtTokenService } from '@/application/services/jwt-token.service';

export const platformAdminAuthProviders = [
  {
    provide: PLATFORM_IDENTITY_RESOLVER,
    inject: [JwtTokenService],
    useFactory: (jwtTokenService: JwtTokenService) =>
      createBearerIdentityResolver(async (authorization) => {
        const { user } =
          await jwtTokenService.resolveVerifiedUserContext(authorization);
        return {
          permissions: user.permissions,
          role: user.role,
          roles: user.roles,
          userId: user.userId,
        };
      }),
  },
  PlatformAdminGuard,
];

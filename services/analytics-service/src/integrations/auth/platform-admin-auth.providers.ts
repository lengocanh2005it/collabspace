import {
  PLATFORM_IDENTITY_RESOLVER,
  PlatformAdminGuard,
  createBearerIdentityResolver,
} from '@collabspace/nest-auth';
import { AuthGrpcService } from './auth-grpc.service.js';

export const platformAdminAuthProviders = [
  {
    provide: PLATFORM_IDENTITY_RESOLVER,
    inject: [AuthGrpcService],
    useFactory: (authGrpcService: AuthGrpcService) =>
      createBearerIdentityResolver((authorization) =>
        authGrpcService.verifyAccessToken(authorization),
      ),
  },
  PlatformAdminGuard,
];

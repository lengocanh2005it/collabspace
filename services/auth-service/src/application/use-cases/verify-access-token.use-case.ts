import { AuthIdentity } from '@/domain/types/jwt';
import { Injectable } from '@nestjs/common';
import { JwtTokenService } from '../services/jwt-token.service';
import { readFirstString } from '../services/jwt-payload.util';
import { UserProfileResolverService } from '../services/user-profile-resolver.service';

@Injectable()
export class VerifyAccessTokenUseCase {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly userProfileResolverService: UserProfileResolverService,
  ) {}

  async execute(authorizationHeader?: string): Promise<AuthIdentity> {
    const { payload, user, userId } =
      await this.jwtTokenService.resolveVerifiedUserContext(
        authorizationHeader,
      );
    const profileIdentity = await this.userProfileResolverService.resolve(userId);

    return {
      emailVerified: user.emailVerified,
      fullName: profileIdentity.fullName,
      permissions: user.permissions,
      profileStatus: profileIdentity.profileStatus ?? 'available',
      roles: user.roles,
      userId,
      role: user.role,
      username: profileIdentity.username,
      workspaceId: readFirstString(
        payload.workspaceId,
        payload.workspace_id,
        payload.tenantId,
        payload.tenant_id,
      ),
    };
  }
}

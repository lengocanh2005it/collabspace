import type { AuthUser } from '@/domain/entities/auth-user';
import { Injectable } from '@nestjs/common';
import { JwtTokenService } from '../services/jwt-token.service';
import { readFirstString } from '../services/jwt-payload.util';
import { UserProfileResolverService } from '../services/user-profile-resolver.service';

@Injectable()
export class GetCurrentUserUseCase {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly userProfileResolverService: UserProfileResolverService,
  ) {}

  async execute(authorizationHeader?: string): Promise<
    AuthUser & {
      fullName?: string;
      username?: string;
      profileStatus?: 'available' | 'unavailable';
      workspaceId?: string | null;
    }
  > {
    const { payload, user } =
      await this.jwtTokenService.resolveVerifiedUserContext(authorizationHeader);
    const profileIdentity = await this.userProfileResolverService.resolve(user.userId);

    return {
      ...user,
      fullName: profileIdentity.fullName,
      username: profileIdentity.username,
      profileStatus: profileIdentity.profileStatus ?? 'available',
      workspaceId:
        readFirstString(
          payload.workspaceId,
          payload.workspace_id,
          payload.tenantId,
          payload.tenant_id,
        ) ?? null,
    };
  }
}

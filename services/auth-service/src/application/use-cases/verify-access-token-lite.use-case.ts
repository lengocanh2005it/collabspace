import type { AuthLiteIdentity } from '@/domain/types/jwt';
import { JwtTokenService } from '@/application/services/jwt-token.service';
import { AccessTokenVerifyLiteCacheService } from '@/infrastructure/redis/access-token-verify-lite-cache.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class VerifyAccessTokenLiteUseCase {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly verifyLiteCache: AccessTokenVerifyLiteCacheService,
  ) {}

  async execute(authorizationHeader?: string): Promise<AuthLiteIdentity> {
    const token = this.jwtTokenService.extractBearerToken(authorizationHeader);
    const cached = await this.verifyLiteCache.read(token);

    if (cached) {
      return cached;
    }

    const context = await this.jwtTokenService.resolveVerifiedLiteUserContext(authorizationHeader);

    const identity: AuthLiteIdentity = {
      emailVerified: context.emailVerified,
      role: context.role,
      roles: context.roles,
      userId: context.userId,
      workspaceId: context.workspaceId,
    };

    await this.verifyLiteCache.write(token, identity, context.expiresAt);

    return identity;
  }
}

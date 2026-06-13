import type { AuthSessionResponseDto } from '@/application/dto/auth-session-response.dto';
import { AuthUser } from '@/common/types/identity.type';
import { RefreshTokensService } from '@/modules/refresh-tokens/refresh-tokens.service';
import { Injectable } from '@nestjs/common';
import { JwtTokenService } from './jwt-token.service';

@Injectable()
export class SessionIssuanceService {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  async issue(
    user: AuthUser,
    workspaceId?: string,
  ): Promise<AuthSessionResponseDto> {
    const accessToken = await this.jwtTokenService.signAccessToken({
      role: user.role,
      roles: user.roles,
      userId: user.userId,
      workspaceId,
    });
    const refreshTokenPayload = await this.refreshTokensService.issue({
      userId: user.userId,
      workspaceId,
    });

    return {
      accessToken,
      email: user.email,
      expiresIn: this.jwtTokenService.getJwtExpiry(),
      refreshToken: refreshTokenPayload.refreshToken,
      role: user.role,
      roles: user.roles,
      userId: user.userId,
      workspaceId: workspaceId ?? null,
    };
  }
}

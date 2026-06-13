import type { AuthSessionResponseDto } from '@/application/dto/auth-session-response.dto';
import { AuthUser } from '@/common/types/identity.type';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '@/domain/repositories/refresh-token.repository';
import { Inject, Injectable } from '@nestjs/common';
import { JwtTokenService } from './jwt-token.service';

@Injectable()
export class SessionIssuanceService {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
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
    const refreshTokenPayload = await this.refreshTokenRepository.issue({
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

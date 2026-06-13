import { RefreshSessionRequestDto } from '@/application/dto/auth-request.dto';
import type { AuthSessionResponseDto } from '@/application/dto/auth-session-response.dto';
import { IdentityService } from '@/modules/identity/identity.service';
import { RefreshTokensService } from '@/modules/refresh-tokens/refresh-tokens.service';
import { Injectable } from '@nestjs/common';
import { JwtTokenService } from '../services/jwt-token.service';
import { assertRefreshTokenPresent } from '../services/refresh-token-input.util';

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    private readonly identityService: IdentityService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  async execute(
    input: RefreshSessionRequestDto,
  ): Promise<AuthSessionResponseDto> {
    assertRefreshTokenPresent(input.refreshToken);
    const refreshTokenPayload = await this.refreshTokensService.rotate(
      input.refreshToken,
    );
    const user = await this.identityService.getAuthUserById(
      refreshTokenPayload.userId,
    );
    const accessToken = await this.jwtTokenService.signAccessToken({
      role: user.role,
      roles: user.roles,
      userId: refreshTokenPayload.userId,
      workspaceId: refreshTokenPayload.workspaceId ?? undefined,
    });

    return {
      accessToken,
      email: user.email,
      expiresIn: this.jwtTokenService.getJwtExpiry(),
      refreshToken: refreshTokenPayload.refreshToken,
      role: user.role,
      roles: user.roles,
      userId: refreshTokenPayload.userId,
      workspaceId: refreshTokenPayload.workspaceId ?? null,
    };
  }
}

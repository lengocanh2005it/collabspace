import type { RefreshSessionRequestDto } from '@/application/dto/auth-request.dto';
import type { AuthSessionResponseDto } from '@/application/dto/auth-session-response.dto';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '@/domain/repositories/refresh-token.repository';
import { USER_REPOSITORY, type UserRepository } from '@/domain/repositories/user.repository';
import { Inject, Injectable } from '@nestjs/common';
import { JwtTokenService } from '../services/jwt-token.service';
import { assertRefreshTokenPresent } from '../services/refresh-token-input.util';

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly jwtTokenService: JwtTokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(input: RefreshSessionRequestDto): Promise<AuthSessionResponseDto> {
    assertRefreshTokenPresent(input.refreshToken);
    const refreshTokenPayload = await this.refreshTokenRepository.rotate(input.refreshToken);
    const user = await this.userRepository.getAuthUserById(refreshTokenPayload.userId);
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
      familyId: refreshTokenPayload.familyId,
      role: user.role,
      roles: user.roles,
      userId: refreshTokenPayload.userId,
      workspaceId: refreshTokenPayload.workspaceId ?? null,
    };
  }
}

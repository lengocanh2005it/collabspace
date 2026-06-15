import type { LogoutAllResult } from '@/application/dto/auth-use-case-results';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '@/domain/repositories/refresh-token.repository';
import { Inject, Injectable } from '@nestjs/common';
import { JwtTokenService } from '../services/jwt-token.service';

@Injectable()
export class LogoutAllUseCase {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(authorizationHeader: string | undefined): Promise<LogoutAllResult> {
    const { userId } = await this.jwtTokenService.resolveVerifiedUserContext(authorizationHeader);
    const revokedSessionCount = await this.refreshTokenRepository.revokeAllForUser(
      userId,
      'logout_all',
    );

    return {
      revoked: true,
      revokedSessionCount,
    };
  }
}

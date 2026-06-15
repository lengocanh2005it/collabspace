import type { RevokeSessionResult } from '@/application/dto/auth-use-case-results';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '@/domain/repositories/refresh-token.repository';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtTokenService } from '../services/jwt-token.service';

@Injectable()
export class RevokeSessionUseCase {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(
    authorizationHeader: string | undefined,
    familyId: string,
  ): Promise<RevokeSessionResult> {
    const { userId } = await this.jwtTokenService.resolveVerifiedUserContext(authorizationHeader);
    const revokedCount = await this.refreshTokenRepository.revokeFamilyForUser(
      userId,
      familyId,
      'session_revoked',
    );

    if (revokedCount === 0) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session was not found',
      });
    }

    return {
      revoked: true,
      familyId,
    };
  }
}

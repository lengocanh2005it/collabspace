import type { LogoutOthersRequestDto } from '@/application/dto/auth-request.dto';
import type { LogoutOthersResult } from '@/application/dto/auth-use-case-results';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '@/domain/repositories/refresh-token.repository';
import { Inject, Injectable } from '@nestjs/common';
import { assertRefreshTokenPresent } from '../services/refresh-token-input.util';
import { JwtTokenService } from '../services/jwt-token.service';

@Injectable()
export class LogoutOthersUseCase {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(
    authorizationHeader: string | undefined,
    input: LogoutOthersRequestDto,
  ): Promise<LogoutOthersResult> {
    const { userId } = await this.jwtTokenService.resolveVerifiedUserContext(authorizationHeader);
    assertRefreshTokenPresent(input.refreshToken);
    const revokedSessionCount = await this.refreshTokenRepository.revokeOtherFamiliesForUser(
      userId,
      input.refreshToken,
      'logout_others',
    );

    return {
      revoked: true,
      revokedSessionCount,
    };
  }
}

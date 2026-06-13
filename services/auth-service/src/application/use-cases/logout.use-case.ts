import { LogoutRequestDto } from '@/application/dto/auth-request.dto';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '@/domain/repositories/refresh-token.repository';
import { Inject, Injectable } from '@nestjs/common';
import { assertRefreshTokenPresent } from '../services/refresh-token-input.util';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(input: LogoutRequestDto): Promise<{ revoked: true }> {
    assertRefreshTokenPresent(input.refreshToken);
    await this.refreshTokenRepository.revokeToken(
      input.refreshToken,
      'logged_out',
    );

    return { revoked: true };
  }
}

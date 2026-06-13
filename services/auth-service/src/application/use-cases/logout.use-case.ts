import { LogoutRequestDto } from '@/application/dto/auth-request.dto';
import { RefreshTokensService } from '@/modules/refresh-tokens/refresh-tokens.service';
import { Injectable } from '@nestjs/common';
import { assertRefreshTokenPresent } from '../services/refresh-token-input.util';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  async execute(input: LogoutRequestDto): Promise<{ revoked: true }> {
    assertRefreshTokenPresent(input.refreshToken);
    await this.refreshTokensService.revokeToken(
      input.refreshToken,
      'logged_out',
    );

    return { revoked: true };
  }
}

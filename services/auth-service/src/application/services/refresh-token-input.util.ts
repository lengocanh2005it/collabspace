import { UnauthorizedException } from '@nestjs/common';

export function assertRefreshTokenPresent(refreshToken?: string): void {
  if (!refreshToken || refreshToken.trim().length === 0) {
    throw new UnauthorizedException({
      code: 'REFRESH_TOKEN_MISSING',
      message: 'Refresh token is required',
    });
  }
}

import { ResetPasswordRequestDto } from '@/application/dto/auth-request.dto';
import type { ResetPasswordResult } from '@/application/dto/auth-use-case-results';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '@/domain/repositories/refresh-token.repository';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '@/domain/repositories/user.repository';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PasswordResetTokenService } from '../services/password-reset-token.service';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordResetTokenService: PasswordResetTokenService,
  ) {}

  async execute(input: ResetPasswordRequestDto): Promise<ResetPasswordResult> {
    const payload = await this.passwordResetTokenService.consumeToken(
      input.token,
    );

    if (!payload) {
      throw new UnauthorizedException({
        code: 'PASSWORD_RESET_TOKEN_INVALID',
        message: 'Password reset token is invalid or expired',
      });
    }

    const user = await this.userRepository.getAuthUserById(payload.userId);

    if (!user.emailVerified) {
      throw new UnauthorizedException({
        code: 'PASSWORD_RESET_NOT_ALLOWED',
        message: 'Password reset is not allowed for this account',
      });
    }

    await this.userRepository.resetPassword(payload.userId, input.newPassword);
    const revokedSessionCount = await this.refreshTokenRepository.revokeAllForUser(
      payload.userId,
      'password_reset',
    );

    return {
      message: 'Password reset successfully',
      reset: true,
      revokedSessionCount,
      userId: payload.userId,
    };
  }
}

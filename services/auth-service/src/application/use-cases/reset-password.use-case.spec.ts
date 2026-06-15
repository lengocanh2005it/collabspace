import { ResetPasswordUseCase } from '@/application/use-cases/reset-password.use-case';
import type { PasswordResetTokenService } from '@/application/services/password-reset-token.service';
import type { AuthUser } from '@/domain/entities/auth-user';
import type { RefreshTokenRepository } from '@/domain/repositories/refresh-token.repository';
import type { UserRepository } from '@/domain/repositories/user.repository';
import { UnauthorizedException } from '@nestjs/common';

describe('ResetPasswordUseCase', () => {
  const user: AuthUser = {
    email: 'member@collabspace.dev',
    emailVerified: true,
    isActive: true,
    permissions: [],
    role: 'member',
    roles: ['member'],
    userId: 'user-1',
    workspaceId: null,
  };

  let userRepository: jest.Mocked<UserRepository>;
  let refreshTokenRepository: jest.Mocked<RefreshTokenRepository>;
  let passwordResetTokenService: jest.Mocked<PasswordResetTokenService>;
  let useCase: ResetPasswordUseCase;

  beforeEach(() => {
    userRepository = {
      getAuthUserById: jest.fn(),
      resetPassword: jest.fn(),
    };
    refreshTokenRepository = {
      revokeAllForUser: jest.fn(),
    };
    passwordResetTokenService = {
      consumeToken: jest.fn(),
    };
    useCase = new ResetPasswordUseCase(
      userRepository,
      refreshTokenRepository,
      passwordResetTokenService,
    );
  });

  it('rejects invalid reset tokens', async () => {
    passwordResetTokenService.consumeToken.mockResolvedValue(null);

    await expect(
      useCase.execute({ token: 'bad-token', newPassword: 'newpassword1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('resets password and revokes sessions for valid tokens', async () => {
    passwordResetTokenService.consumeToken.mockResolvedValue({
      email: user.email,
      userId: user.userId,
    });
    userRepository.getAuthUserById.mockResolvedValue(user);
    refreshTokenRepository.revokeAllForUser.mockResolvedValue(2);

    await expect(
      useCase.execute({ token: 'valid-token', newPassword: 'newpassword1' }),
    ).resolves.toEqual({
      message: 'Password reset successfully',
      reset: true,
      revokedSessionCount: 2,
      userId: user.userId,
    });
    expect(userRepository.resetPassword).toHaveBeenCalledWith(user.userId, 'newpassword1');
  });
});

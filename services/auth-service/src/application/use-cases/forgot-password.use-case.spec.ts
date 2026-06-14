import { ForgotPasswordUseCase } from '@/application/use-cases/forgot-password.use-case';
import { PasswordResetTokenService } from '@/application/services/password-reset-token.service';
import type { AuthUser } from '@/domain/entities/auth-user';
import type { UserRepository } from '@/domain/repositories/user.repository';

describe('ForgotPasswordUseCase', () => {
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
  let passwordResetTokenService: jest.Mocked<PasswordResetTokenService>;
  let useCase: ForgotPasswordUseCase;

  beforeEach(() => {
    userRepository = {
      findUserByEmail: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;
    passwordResetTokenService = {
      send: jest.fn(),
    } as unknown as jest.Mocked<PasswordResetTokenService>;
    useCase = new ForgotPasswordUseCase(
      userRepository,
      passwordResetTokenService,
    );
  });

  it('returns a generic success message when the email is unknown', async () => {
    userRepository.findUserByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'missing@collabspace.dev' }),
    ).resolves.toEqual({
      message:
        'If the account exists, password reset instructions were sent.',
      sent: true,
    });
    expect(passwordResetTokenService.send).not.toHaveBeenCalled();
  });

  it('sends a reset token for verified users', async () => {
    userRepository.findUserByEmail.mockResolvedValue(user);
    passwordResetTokenService.send.mockResolvedValue({
      email: user.email,
      tokenTtlSeconds: 1800,
      userId: user.userId,
    });

    await expect(
      useCase.execute({ email: user.email }),
    ).resolves.toEqual({
      message:
        'If the account exists, password reset instructions were sent.',
      sent: true,
    });
    expect(passwordResetTokenService.send).toHaveBeenCalledWith(user);
  });

  it('does not send reset email for unverified users', async () => {
    userRepository.findUserByEmail.mockResolvedValue({
      ...user,
      emailVerified: false,
    });

    await useCase.execute({ email: user.email });
    expect(passwordResetTokenService.send).not.toHaveBeenCalled();
  });
});

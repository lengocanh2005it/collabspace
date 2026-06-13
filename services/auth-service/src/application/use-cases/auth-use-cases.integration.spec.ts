import { ConfigurationService } from '@/configuration/configuration.service';
import { ChangePasswordUseCase } from '@/application/use-cases/change-password.use-case';
import { GetCurrentUserUseCase } from '@/application/use-cases/get-current-user.use-case';
import { LoginUseCase } from '@/application/use-cases/login.use-case';
import { LogoutUseCase } from '@/application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '@/application/use-cases/refresh-session.use-case';
import { RegisterUseCase } from '@/application/use-cases/register.use-case';
import { ResendEmailVerificationOtpUseCase } from '@/application/use-cases/resend-email-verification-otp.use-case';
import { VerifyAccessTokenUseCase } from '@/application/use-cases/verify-access-token.use-case';
import { VerifyEmailOtpUseCase } from '@/application/use-cases/verify-email-otp.use-case';
import { EmailVerificationOtpService } from '@/application/services/email-verification-otp.service';
import { JwtTokenService } from '@/application/services/jwt-token.service';
import { SessionIssuanceService } from '@/application/services/session-issuance.service';
import { UserProfileResolverService } from '@/application/services/user-profile-resolver.service';
import { UserRepository } from '@/domain/repositories/user.repository';
import { RefreshTokenRepository } from '@/domain/repositories/refresh-token.repository';
import { UserProfileClient } from '@/domain/ports/user-profile-client.port';
import { EmailOutbox } from '@/domain/ports/email-outbox.port';
import { OtpStore } from '@/domain/ports/otp-store.port';
import {
  ConflictException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

type AuthTestHarness = {
  jwtTokenService: JwtTokenService;
  verifyAccessTokenUseCase: VerifyAccessTokenUseCase;
  getCurrentUserUseCase: GetCurrentUserUseCase;
  loginUseCase: LoginUseCase;
  logoutUseCase: LogoutUseCase;
  refreshSessionUseCase: RefreshSessionUseCase;
  registerUseCase: RegisterUseCase;
  resendEmailVerificationOtpUseCase: ResendEmailVerificationOtpUseCase;
  verifyEmailOtpUseCase: VerifyEmailOtpUseCase;
  changePasswordUseCase: ChangePasswordUseCase;
};

describe('Auth use cases (integration)', () => {
  const jwtConfigValues = {
    audience: undefined as string | undefined,
    expiry: '10m',
    issuer: undefined as string | undefined,
    secret: 'unit-test-secret',
  };
  const configurationServiceMock = {
    getAuthJwtConfig: jest.fn(() => ({ ...jwtConfigValues })),
    getEmailVerificationConfig: jest.fn(() => ({
      otpLength: 6,
      otpTtlSeconds: 600,
      resendCooldownSeconds: 60,
      resendMaxAttempts: 5,
      resendWindowSeconds: 3600,
    })),
  } as unknown as ConfigurationService;
  const emailOutboxMock = {
    enqueueEmailVerificationOtp: jest.fn(),
    getStats: jest.fn(),
  } as unknown as EmailOutbox;
  const refreshTokenRepositoryMock = {
    issue: jest.fn(),
    revokeAllForUser: jest.fn(),
    revokeToken: jest.fn(),
    rotate: jest.fn(),
  } as unknown as RefreshTokenRepository;
  const otpStoreMock = {
    assertAvailable: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    getJson: jest.fn(),
    increment: jest.fn(),
    ping: jest.fn(),
    set: jest.fn(),
    setJson: jest.fn(),
    ttl: jest.fn(),
  } as unknown as OtpStore;
  const identityServiceMock = {
    changePassword: jest.fn(),
    findUserByEmail: jest.fn(),
    getAuthUserById: jest.fn(),
    markEmailVerified: jest.fn(),
    register: jest.fn(),
    rollbackNewRegistration: jest.fn(),
    validateCredentials: jest.fn(),
  } as unknown as UserRepository;
  const userProfileClientMock = {
    createPendingProfile: jest.fn(),
    getProfile: jest.fn(),
    ping: jest.fn(),
  } as unknown as UserProfileClient;

  let harness: AuthTestHarness;

  function buildAuthHarness(): AuthTestHarness {
    const jwtTokenService = new JwtTokenService(
      configurationServiceMock,
      identityServiceMock,
    );
    const userProfileResolverService = new UserProfileResolverService(
      userProfileClientMock,
    );
    const sessionIssuanceService = new SessionIssuanceService(
      jwtTokenService,
      refreshTokenRepositoryMock,
    );
    const emailVerificationOtpService = new EmailVerificationOtpService(
      configurationServiceMock,
      emailOutboxMock,
      otpStoreMock,
    );

    return {
      jwtTokenService,
      verifyAccessTokenUseCase: new VerifyAccessTokenUseCase(
        jwtTokenService,
        userProfileResolverService,
      ),
      getCurrentUserUseCase: new GetCurrentUserUseCase(
        jwtTokenService,
        userProfileResolverService,
      ),
      loginUseCase: new LoginUseCase(identityServiceMock, sessionIssuanceService),
      logoutUseCase: new LogoutUseCase(refreshTokenRepositoryMock),
      refreshSessionUseCase: new RefreshSessionUseCase(
        identityServiceMock,
        jwtTokenService,
        refreshTokenRepositoryMock,
      ),
      registerUseCase: new RegisterUseCase(
        identityServiceMock,
        userProfileClientMock,
        emailVerificationOtpService,
      ),
      resendEmailVerificationOtpUseCase: new ResendEmailVerificationOtpUseCase(
        identityServiceMock,
        emailVerificationOtpService,
      ),
      verifyEmailOtpUseCase: new VerifyEmailOtpUseCase(
        identityServiceMock,
        otpStoreMock,
        emailVerificationOtpService,
      ),
      changePasswordUseCase: new ChangePasswordUseCase(
        identityServiceMock,
        jwtTokenService,
        refreshTokenRepositoryMock,
      ),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jwtConfigValues.secret = 'unit-test-secret';
    jwtConfigValues.expiry = '10m';
    jwtConfigValues.audience = undefined;
    jwtConfigValues.issuer = undefined;
    jest.spyOn(otpStoreMock, 'delete').mockResolvedValue(1);
    jest.spyOn(otpStoreMock, 'assertAvailable').mockResolvedValue(undefined);
    harness = buildAuthHarness();
  });

  it('extracts identity from a valid token', async () => {
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'admin@collabspace.dev',
      emailVerified: true,
      isActive: true,
      permissions: ['users.read'],
      role: 'admin',
      roles: ['admin'],
      userId: 'user-1',
    });
    jest.spyOn(userProfileClientMock, 'getProfile').mockResolvedValue({
      fullName: 'Admin User',
      userId: 'user-1',
      username: 'admin.user',
    });

    const token = await harness.jwtTokenService.signAccessToken({
      role: 'admin',
      roles: ['admin'],
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    await expect(
      harness.verifyAccessTokenUseCase.execute(`Bearer ${token}`),
    ).resolves.toEqual({
      emailVerified: true,
      fullName: 'Admin User',
      permissions: ['users.read'],
      profileStatus: 'available',
      role: 'admin',
      roles: ['admin'],
      userId: 'user-1',
      username: 'admin.user',
      workspaceId: 'workspace-1',
    });
  });

  it('rejects requests without bearer token', async () => {
    await expect(harness.verifyAccessTokenUseCase.execute(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('issues access and refresh tokens on login', async () => {
    jest.spyOn(identityServiceMock, 'validateCredentials').mockResolvedValue({
      email: 'admin@collabspace.dev',
      emailVerified: true,
      isActive: true,
      permissions: ['users.read'],
      role: 'admin',
      roles: ['admin'],
      userId: 'user-1',
    });
    jest.spyOn(refreshTokenRepositoryMock, 'issue').mockResolvedValue({
      refreshToken: 'refresh-token-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    const session = await harness.loginUseCase.execute({
      email: 'admin@collabspace.dev',
      password: 'password123',
      workspaceId: 'workspace-1',
    });

    expect(session.email).toBe('admin@collabspace.dev');
    expect(session.refreshToken).toBe('refresh-token-1');
    expect(session.userId).toBe('user-1');
    expect(session.role).toBe('admin');
    expect(session.roles).toEqual(['admin']);
  });

  it('rotates refresh token into a new session', async () => {
    jest.spyOn(refreshTokenRepositoryMock, 'rotate').mockResolvedValue({
      refreshToken: 'refresh-token-2',
      userId: 'user-2',
      workspaceId: 'workspace-2',
    });
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'member@collabspace.dev',
      emailVerified: true,
      isActive: true,
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      userId: 'user-2',
    });

    const session = await harness.refreshSessionUseCase.execute({
      refreshToken: 'old-refresh-token',
    });

    expect(session.refreshToken).toBe('refresh-token-2');
    expect(session.userId).toBe('user-2');
    expect(session.role).toBe('member');
  });

  it('registers a new user, creates a pending profile, and queues OTP email', async () => {
    jest.spyOn(identityServiceMock, 'register').mockResolvedValue({
      email: 'new@collabspace.dev',
      emailVerified: false,
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-3',
    });
    jest
      .spyOn(userProfileClientMock, 'createPendingProfile')
      .mockResolvedValue(undefined);
    jest.spyOn(otpStoreMock, 'setJson').mockResolvedValue('OK');
    jest.spyOn(otpStoreMock, 'assertAvailable').mockResolvedValue(undefined);
    jest
      .spyOn(emailOutboxMock, 'enqueueEmailVerificationOtp')
      .mockResolvedValue(undefined);

    const result = await harness.registerUseCase.execute({
      email: 'new@collabspace.dev',
      fullName: 'New User',
      password: 'password123',
    });

    expect(result).toEqual({
      email: 'new@collabspace.dev',
      emailVerified: false,
      otpExpiresInSeconds: 600,
      userId: 'user-3',
      verificationRequired: true,
    });
    expect(userProfileClientMock.createPendingProfile).toHaveBeenCalledWith({
      fullName: 'New User',
      userId: 'user-3',
    });
    expect(emailOutboxMock.enqueueEmailVerificationOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@collabspace.dev',
        otp: expect.any(String),
        otpTtlSeconds: 600,
        userId: 'user-3',
      }),
    );
  });

  it('rolls back a newly created auth user when profile bootstrap fails', async () => {
    jest.spyOn(identityServiceMock, 'register').mockResolvedValue({
      email: 'new@collabspace.dev',
      emailVerified: false,
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-3',
    });
    jest
      .spyOn(userProfileClientMock, 'createPendingProfile')
      .mockRejectedValue(
        new ServiceUnavailableException({
          code: 'USER_SERVICE_GRPC_UNAVAILABLE',
          message: 'User profiles gRPC client is not initialized',
        }),
      );
    jest.spyOn(identityServiceMock, 'rollbackNewRegistration').mockResolvedValue();

    await expect(
      harness.registerUseCase.execute({
        email: 'new@collabspace.dev',
        fullName: 'New User',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(identityServiceMock.rollbackNewRegistration).toHaveBeenCalledWith('user-3');
    expect(emailOutboxMock.enqueueEmailVerificationOtp).not.toHaveBeenCalled();
  });

  it('does not roll back when profile bootstrap fails for recovered pending user', async () => {
    jest.spyOn(identityServiceMock, 'register').mockRejectedValue(
      new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message: 'User already exists',
      }),
    );
    jest.spyOn(identityServiceMock, 'findUserByEmail').mockResolvedValue({
      email: 'new@collabspace.dev',
      emailVerified: false,
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-3',
    });
    jest
      .spyOn(userProfileClientMock, 'createPendingProfile')
      .mockRejectedValue(
        new ServiceUnavailableException({
          code: 'USER_SERVICE_GRPC_UNAVAILABLE',
          message: 'User service unavailable',
        }),
      );
    jest.spyOn(identityServiceMock, 'rollbackNewRegistration').mockResolvedValue();

    await expect(
      harness.registerUseCase.execute({
        email: 'new@collabspace.dev',
        fullName: 'New User',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(identityServiceMock.rollbackNewRegistration).not.toHaveBeenCalled();
  });

  it('rolls back a newly created auth user when Redis OTP storage fails', async () => {
    jest.spyOn(identityServiceMock, 'register').mockResolvedValue({
      email: 'new@collabspace.dev',
      emailVerified: false,
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-3',
    });
    jest
      .spyOn(userProfileClientMock, 'createPendingProfile')
      .mockResolvedValue(undefined);
    jest
      .spyOn(otpStoreMock, 'assertAvailable')
      .mockRejectedValue(
        new ServiceUnavailableException({
          code: 'REDIS_UNAVAILABLE',
          message: 'Redis is unavailable',
        }),
      );
    jest.spyOn(identityServiceMock, 'rollbackNewRegistration').mockResolvedValue();

    await expect(
      harness.registerUseCase.execute({
        email: 'new@collabspace.dev',
        fullName: 'New User',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      response: { code: 'REDIS_UNAVAILABLE' },
    });

    expect(identityServiceMock.rollbackNewRegistration).toHaveBeenCalledWith('user-3');
    expect(emailOutboxMock.enqueueEmailVerificationOtp).not.toHaveBeenCalled();
  });

  it('recovers pending registration for an existing unverified user', async () => {
    jest.spyOn(identityServiceMock, 'register').mockRejectedValue(
      new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message: 'User already exists',
      }),
    );
    jest.spyOn(identityServiceMock, 'findUserByEmail').mockResolvedValue({
      email: 'new@collabspace.dev',
      emailVerified: false,
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-3',
    });
    jest
      .spyOn(userProfileClientMock, 'createPendingProfile')
      .mockResolvedValue(undefined);
    jest.spyOn(otpStoreMock, 'setJson').mockResolvedValue('OK');
    jest.spyOn(otpStoreMock, 'assertAvailable').mockResolvedValue(undefined);
    jest
      .spyOn(emailOutboxMock, 'enqueueEmailVerificationOtp')
      .mockResolvedValue(undefined);

    const result = await harness.registerUseCase.execute({
      email: 'new@collabspace.dev',
      fullName: 'New User',
      password: 'password123',
    });

    expect(result.verificationRequired).toBe(true);
    expect(identityServiceMock.findUserByEmail).toHaveBeenCalledWith(
      'new@collabspace.dev',
    );
  });

  it('resends verification otp for a pending user', async () => {
    jest.spyOn(identityServiceMock, 'findUserByEmail').mockResolvedValue({
      email: 'pending@collabspace.dev',
      emailVerified: false,
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-5',
    });
    jest.spyOn(otpStoreMock, 'exists').mockResolvedValue(false);
    jest.spyOn(otpStoreMock, 'increment').mockResolvedValue(1);
    jest.spyOn(otpStoreMock, 'expire').mockResolvedValue(true);
    jest.spyOn(otpStoreMock, 'set').mockResolvedValue('OK');
    jest.spyOn(otpStoreMock, 'setJson').mockResolvedValue('OK');
    jest.spyOn(otpStoreMock, 'assertAvailable').mockResolvedValue(undefined);
    jest
      .spyOn(emailOutboxMock, 'enqueueEmailVerificationOtp')
      .mockResolvedValue(undefined);

    await expect(
      harness.resendEmailVerificationOtpUseCase.execute({
        email: 'pending@collabspace.dev',
      }),
    ).resolves.toEqual({
      email: 'pending@collabspace.dev',
      emailVerified: false,
      otpExpiresInSeconds: 600,
      resent: true,
      userId: 'user-5',
    });
  });

  it('rejects resend during cooldown window', async () => {
    jest.spyOn(identityServiceMock, 'findUserByEmail').mockResolvedValue({
      email: 'pending@collabspace.dev',
      emailVerified: false,
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-6',
    });
    jest.spyOn(otpStoreMock, 'exists').mockResolvedValue(true);
    jest.spyOn(otpStoreMock, 'ttl').mockResolvedValue(42);

    await expect(
      harness.resendEmailVerificationOtpUseCase.execute({
        email: 'pending@collabspace.dev',
      }),
    ).rejects.toThrow(HttpException);
  });

  it('verifies email otp and marks auth user as verified', async () => {
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'new@collabspace.dev',
      emailVerified: false,
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-3',
    });
    jest.spyOn(otpStoreMock, 'getJson').mockResolvedValue({
      email: 'new@collabspace.dev',
      otpHash:
        '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    });
    jest.spyOn(identityServiceMock, 'markEmailVerified').mockResolvedValue({
      email: 'new@collabspace.dev',
      emailVerified: true,
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-3',
    });

    await expect(
      harness.verifyEmailOtpUseCase.execute({
        otp: '123456',
        userId: 'user-3',
      }),
    ).resolves.toEqual({
      email: 'new@collabspace.dev',
      emailVerified: true,
      verified: true,
    });
  });

  it('treats verify email as idempotent for already verified users', async () => {
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'verified@collabspace.dev',
      emailVerified: true,
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-9',
    });

    await expect(
      harness.verifyEmailOtpUseCase.execute({
        otp: '123456',
        userId: 'user-9',
      }),
    ).resolves.toEqual({
      email: 'verified@collabspace.dev',
      emailVerified: true,
      verified: true,
    });
  });

  it('returns the current authenticated user with profile identity', async () => {
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'admin@collabspace.dev',
      emailVerified: true,
      isActive: true,
      permissions: ['users.read', 'users.write'],
      role: 'admin',
      roles: ['admin'],
      userId: 'user-4',
    });
    jest.spyOn(userProfileClientMock, 'getProfile').mockResolvedValue({
      fullName: 'Admin User',
      userId: 'user-4',
      username: 'admin.user',
    });
    const token = await harness.jwtTokenService.signAccessToken({
      role: 'admin',
      roles: ['admin'],
      userId: 'user-4',
      workspaceId: 'workspace-4',
    });

    await expect(
      harness.getCurrentUserUseCase.execute(`Bearer ${token}`),
    ).resolves.toEqual({
      email: 'admin@collabspace.dev',
      emailVerified: true,
      fullName: 'Admin User',
      isActive: true,
      permissions: ['users.read', 'users.write'],
      profileStatus: 'available',
      role: 'admin',
      roles: ['admin'],
      userId: 'user-4',
      username: 'admin.user',
      workspaceId: 'workspace-4',
    });
  });

  it('keeps token verification working when profile lookup fails', async () => {
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'fallback@collabspace.dev',
      emailVerified: true,
      isActive: true,
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      userId: 'user-8',
    });
    jest
      .spyOn(userProfileClientMock, 'getProfile')
      .mockRejectedValue(new Error('profile service unavailable'));
    const token = await harness.jwtTokenService.signAccessToken({
      role: 'member',
      roles: ['member'],
      userId: 'user-8',
      workspaceId: 'workspace-8',
    });

    await expect(
      harness.verifyAccessTokenUseCase.execute(`Bearer ${token}`),
    ).resolves.toEqual({
      emailVerified: true,
      fullName: undefined,
      permissions: ['users.read'],
      profileStatus: 'unavailable',
      role: 'member',
      roles: ['member'],
      userId: 'user-8',
      username: undefined,
      workspaceId: 'workspace-8',
    });
  });

  it('changes password for the authenticated user and revokes sessions', async () => {
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'member@collabspace.dev',
      emailVerified: true,
      isActive: true,
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      userId: 'user-2',
    });
    jest.spyOn(identityServiceMock, 'changePassword').mockResolvedValue(undefined);
    jest.spyOn(refreshTokenRepositoryMock, 'revokeAllForUser').mockResolvedValue(2);
    const token = await harness.jwtTokenService.signAccessToken({
      role: 'member',
      roles: ['member'],
      userId: 'user-2',
      workspaceId: 'workspace-2',
    });

    await expect(
      harness.changePasswordUseCase.execute(`Bearer ${token}`, {
        currentPassword: 'password123',
        newPassword: 'password456',
      }),
    ).resolves.toEqual({
      changed: true,
      revokedSessionCount: 2,
      userId: 'user-2',
    });
  });

  it('revokes refresh token on logout', async () => {
    jest
      .spyOn(refreshTokenRepositoryMock, 'revokeToken')
      .mockResolvedValue(undefined);

    await expect(
      harness.logoutUseCase.execute({ refreshToken: 'refresh-token-3' }),
    ).resolves.toEqual({
      revoked: true,
    });
    expect(refreshTokenRepositoryMock.revokeToken).toHaveBeenCalledWith(
      'refresh-token-3',
      'logged_out',
    );
  });
});

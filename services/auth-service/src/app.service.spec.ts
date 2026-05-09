import { ConfigurationService } from '@/configuration/configuration.service';
import { EmailsService } from '@/modules/emails/emails.service';
import { IdentityService } from '@/modules/identity/identity.service';
import { UserProfilesGrpcService } from '@/modules/identity/user-profiles-grpc.service';
import { RabbitMqEventsService } from '@/modules/rabbitmq/rabbitmq-events.service';
import { RedisService } from '@/modules/redis/redis.service';
import { RefreshTokensService } from '@/modules/refresh-tokens/refresh-tokens.service';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './app.service';

describe('AuthService', () => {
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
  const emailsServiceMock = {
    sendText: jest.fn(),
  } as unknown as EmailsService;
  const refreshTokensServiceMock = {
    issue: jest.fn(),
    revokeToken: jest.fn(),
    rotate: jest.fn(),
  } as unknown as RefreshTokensService;
  const redisServiceMock = {
    delete: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    getJson: jest.fn(),
    increment: jest.fn(),
    setJson: jest.fn(),
    set: jest.fn(),
    ttl: jest.fn(),
  } as unknown as RedisService;
  const identityServiceMock = {
    getAuthUserById: jest.fn(),
    markEmailVerified: jest.fn(),
    register: jest.fn(),
    validateCredentials: jest.fn(),
  } as unknown as IdentityService;
  const rabbitMqEventsServiceMock = {
    publishAuthEmailVerified: jest.fn(),
  } as unknown as RabbitMqEventsService;
  const userProfilesGrpcServiceMock = {
    createPendingProfile: jest.fn(),
  } as unknown as UserProfilesGrpcService;
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    jwtConfigValues.secret = 'unit-test-secret';
    jwtConfigValues.expiry = '10m';
    jwtConfigValues.audience = undefined;
    jwtConfigValues.issuer = undefined;
    authService = new AuthService(
      configurationServiceMock,
      emailsServiceMock,
      identityServiceMock,
      rabbitMqEventsServiceMock,
      redisServiceMock,
      refreshTokensServiceMock,
      userProfilesGrpcServiceMock,
    );
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
    const token = await authService.signAccessToken({
      role: 'admin',
      roles: ['admin'],
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });

    await expect(
      authService.verifyAccessToken(`Bearer ${token}`),
    ).resolves.toEqual({
      role: 'admin',
      roles: ['admin'],
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });
  });

  it('rejects expired tokens', async () => {
    jwtConfigValues.expiry = '-10s';
    const token = await authService.signAccessToken({
      userId: 'user-1',
    });

    await expect(
      authService.verifyAccessToken(`Bearer ${token}`),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects requests without bearer token', async () => {
    await expect(authService.verifyAccessToken(undefined)).rejects.toThrow(
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
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'admin@collabspace.dev',
      emailVerified: true,
      isActive: true,
      permissions: ['users.read'],
      role: 'admin',
      roles: ['admin'],
      userId: 'user-1',
    });
    jest.spyOn(refreshTokensServiceMock, 'issue').mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      familyId: 'family-1',
      refreshToken: 'refresh-token-1',
      tokenId: 'token-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    const session = await authService.login({
      email: 'admin@collabspace.dev',
      password: 'password123',
      workspaceId: 'workspace-1',
    });

    expect(session.refreshToken).toBe('refresh-token-1');
    expect(session.userId).toBe('user-1');
    expect(session.role).toBe('admin');
    expect(session.roles).toEqual(['admin']);
    expect(session.email).toBe('admin@collabspace.dev');
    await expect(
      authService.verifyAccessToken(`Bearer ${session.accessToken}`),
    ).resolves.toEqual({
      role: 'admin',
      roles: ['admin'],
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
  });

  it('rotates refresh token into a new session', async () => {
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'member@collabspace.dev',
      emailVerified: true,
      isActive: true,
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      userId: 'user-2',
    });
    jest.spyOn(refreshTokensServiceMock, 'rotate').mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      familyId: 'family-1',
      refreshToken: 'refresh-token-2',
      tokenId: 'token-2',
      userId: 'user-2',
      workspaceId: 'workspace-2',
    });

    const session = await authService.refresh({
      refreshToken: 'old-refresh-token',
    });

    expect(session.refreshToken).toBe('refresh-token-2');
    expect(session.email).toBe('member@collabspace.dev');
    await expect(
      authService.verifyAccessToken(`Bearer ${session.accessToken}`),
    ).resolves.toEqual({
      role: 'member',
      roles: ['member'],
      userId: 'user-2',
      workspaceId: 'workspace-2',
    });
  });

  it('registers a new user, creates a pending profile, and sends OTP email', async () => {
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
      .spyOn(userProfilesGrpcServiceMock, 'createPendingProfile')
      .mockResolvedValue(undefined);
    jest.spyOn(redisServiceMock, 'setJson').mockResolvedValue('OK');
    jest.spyOn(emailsServiceMock, 'sendText').mockResolvedValue({} as never);

    const result = await authService.register({
      email: 'new@collabspace.dev',
      fullName: 'New User',
      password: 'password123',
    });

    expect(result.userId).toBe('user-3');
    expect(result.email).toBe('new@collabspace.dev');
    expect(result.emailVerified).toBe(false);
    expect(redisServiceMock.setJson).toHaveBeenCalled();
    expect(emailsServiceMock.sendText).toHaveBeenCalled();
    expect(
      userProfilesGrpcServiceMock.createPendingProfile,
    ).toHaveBeenCalledWith({
      fullName: 'New User',
      userId: 'user-3',
    });
  });

  it('resends verification otp for a pending user', async () => {
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'pending@collabspace.dev',
      emailVerified: false,
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-5',
    });
    jest.spyOn(redisServiceMock, 'exists').mockResolvedValue(false);
    jest.spyOn(redisServiceMock, 'increment').mockResolvedValue(1);
    jest.spyOn(redisServiceMock, 'expire').mockResolvedValue(true);
    jest.spyOn(redisServiceMock, 'set').mockResolvedValue('OK');
    jest.spyOn(redisServiceMock, 'setJson').mockResolvedValue('OK');
    jest.spyOn(emailsServiceMock, 'sendText').mockResolvedValue({} as never);

    const result = await authService.resendEmailVerificationOtp({
      userId: 'user-5',
    });

    expect(result).toEqual({
      email: 'pending@collabspace.dev',
      emailVerified: false,
      otpExpiresInSeconds: 600,
      resent: true,
      userId: 'user-5',
    });
    expect(redisServiceMock.setJson).toHaveBeenCalled();
    expect(emailsServiceMock.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'pending@collabspace.dev',
      }),
    );
  });

  it('rejects resend during cooldown window', async () => {
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'pending@collabspace.dev',
      emailVerified: false,
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-6',
    });
    jest.spyOn(redisServiceMock, 'exists').mockResolvedValue(true);
    jest.spyOn(redisServiceMock, 'ttl').mockResolvedValue(42);

    await expect(
      authService.resendEmailVerificationOtp({
        userId: 'user-6',
      }),
    ).rejects.toThrow(HttpException);
  });

  it('rejects resend when hourly quota is exhausted', async () => {
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'pending@collabspace.dev',
      emailVerified: false,
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-7',
    });
    jest.spyOn(redisServiceMock, 'exists').mockResolvedValue(false);
    jest.spyOn(redisServiceMock, 'increment').mockResolvedValue(6);
    jest.spyOn(redisServiceMock, 'ttl').mockResolvedValue(1800);

    await expect(
      authService.resendEmailVerificationOtp({
        userId: 'user-7',
      }),
    ).rejects.toThrow(HttpException);
  });

  it('verifies email otp and marks profile as verified', async () => {
    jest.spyOn(redisServiceMock, 'getJson').mockResolvedValue({
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
    jest
      .spyOn(rabbitMqEventsServiceMock, 'publishAuthEmailVerified')
      .mockResolvedValue(undefined);
    jest.spyOn(redisServiceMock, 'delete').mockResolvedValue(1);

    await expect(
      authService.verifyEmailOtp({
        otp: '123456',
        userId: 'user-3',
      }),
    ).resolves.toEqual({
      email: 'new@collabspace.dev',
      emailVerified: true,
      verified: true,
    });
    expect(
      rabbitMqEventsServiceMock.publishAuthEmailVerified,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@collabspace.dev',
        userId: 'user-3',
      }),
    );
  });

  it('returns the current authenticated user', async () => {
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'admin@collabspace.dev',
      emailVerified: true,
      isActive: true,
      permissions: ['users.read', 'users.write'],
      role: 'admin',
      roles: ['admin'],
      userId: 'user-4',
    });
    const token = await authService.signAccessToken({
      role: 'admin',
      roles: ['admin'],
      userId: 'user-4',
      workspaceId: 'workspace-4',
    });

    await expect(
      authService.getCurrentUser(`Bearer ${token}`),
    ).resolves.toEqual({
      email: 'admin@collabspace.dev',
      emailVerified: true,
      isActive: true,
      permissions: ['users.read', 'users.write'],
      role: 'admin',
      roles: ['admin'],
      userId: 'user-4',
      workspaceId: 'workspace-4',
    });
  });

  it('revokes refresh token on logout', async () => {
    jest
      .spyOn(refreshTokensServiceMock, 'revokeToken')
      .mockResolvedValue(undefined);

    await expect(
      authService.logout({ refreshToken: 'refresh-token-3' }),
    ).resolves.toEqual({
      revoked: true,
    });
    expect(refreshTokensServiceMock.revokeToken).toHaveBeenCalledWith(
      'refresh-token-3',
      'logged_out',
    );
  });
});

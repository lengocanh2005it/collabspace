import { ConfigurationService } from '@/configuration/configuration.service';
import { IdentityService } from '@/modules/identity/identity.service';
import { RefreshTokensService } from '@/modules/refresh-tokens/refresh-tokens.service';
import { UnauthorizedException } from '@nestjs/common';
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
  } as unknown as ConfigurationService;
  const refreshTokensServiceMock = {
    issue: jest.fn(),
    revokeToken: jest.fn(),
    rotate: jest.fn(),
  } as unknown as RefreshTokensService;
  const identityServiceMock = {
    getAuthUserById: jest.fn(),
    register: jest.fn(),
    validateCredentials: jest.fn(),
  } as unknown as IdentityService;
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    jwtConfigValues.secret = 'unit-test-secret';
    jwtConfigValues.expiry = '10m';
    jwtConfigValues.audience = undefined;
    jwtConfigValues.issuer = undefined;
    authService = new AuthService(
      configurationServiceMock,
      identityServiceMock,
      refreshTokensServiceMock,
    );
  });

  it('extracts identity from a valid token', async () => {
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'admin@collabspace.dev',
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
      isActive: true,
      permissions: ['users.read'],
      role: 'admin',
      roles: ['admin'],
      userId: 'user-1',
    });
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'admin@collabspace.dev',
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

  it('registers a new user and returns a session', async () => {
    jest.spyOn(identityServiceMock, 'register').mockResolvedValue({
      email: 'new@collabspace.dev',
      isActive: true,
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId: 'user-3',
    });
    jest.spyOn(refreshTokensServiceMock, 'issue').mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      familyId: 'family-3',
      refreshToken: 'refresh-token-3',
      tokenId: 'token-3',
      userId: 'user-3',
      workspaceId: null,
    });

    const session = await authService.register({
      email: 'new@collabspace.dev',
      password: 'password123',
    });

    expect(session.userId).toBe('user-3');
    expect(session.email).toBe('new@collabspace.dev');
    expect(session.roles).toEqual(['user']);
  });

  it('returns the current authenticated user', async () => {
    jest.spyOn(identityServiceMock, 'getAuthUserById').mockResolvedValue({
      email: 'admin@collabspace.dev',
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

    await expect(authService.getCurrentUser(`Bearer ${token}`)).resolves.toEqual(
      {
        email: 'admin@collabspace.dev',
        isActive: true,
        permissions: ['users.read', 'users.write'],
        role: 'admin',
        roles: ['admin'],
        userId: 'user-4',
        workspaceId: 'workspace-4',
      },
    );
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

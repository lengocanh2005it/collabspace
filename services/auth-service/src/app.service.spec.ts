import { UnauthorizedException } from '@nestjs/common';
import { ConfigurationService } from '@/configuration/configuration.service';
import { RefreshTokensService } from '@/modules/refresh-tokens/refresh-tokens.service';
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
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    jwtConfigValues.secret = 'unit-test-secret';
    jwtConfigValues.expiry = '10m';
    jwtConfigValues.audience = undefined;
    jwtConfigValues.issuer = undefined;
    authService = new AuthService(
      configurationServiceMock,
      refreshTokensServiceMock,
    );
  });

  it('extracts identity from a valid token', async () => {
    const token = await authService.signAccessToken({
      role: 'admin',
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });

    await expect(
      authService.verifyAccessToken(`Bearer ${token}`),
    ).resolves.toEqual({
      role: 'admin',
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
    jest.spyOn(refreshTokensServiceMock, 'issue').mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      familyId: 'family-1',
      refreshToken: 'refresh-token-1',
      tokenId: 'token-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    const session = await authService.login({
      role: 'admin',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    expect(session.refreshToken).toBe('refresh-token-1');
    expect(session.userId).toBe('user-1');
    expect(session.role).toBe('admin');
    await expect(
      authService.verifyAccessToken(`Bearer ${session.accessToken}`),
    ).resolves.toEqual({
      role: 'admin',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
  });

  it('rotates refresh token into a new session', async () => {
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
    await expect(
      authService.verifyAccessToken(`Bearer ${session.accessToken}`),
    ).resolves.toEqual({
      role: undefined,
      userId: 'user-2',
      workspaceId: 'workspace-2',
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

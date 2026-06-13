import { UnauthorizedException } from '@nestjs/common';
import { VerifyAccessTokenLiteUseCase } from './verify-access-token-lite.use-case';
import type { JwtTokenService } from '@/application/services/jwt-token.service';
import type { AccessTokenVerifyLiteCacheService } from '@/infrastructure/redis/access-token-verify-lite-cache.service';

describe('VerifyAccessTokenLiteUseCase', () => {
  const jwtTokenService = {
    extractBearerToken: jest.fn(),
    resolveVerifiedLiteUserContext: jest.fn(),
  } as unknown as JwtTokenService;

  const verifyLiteCache = {
    read: jest.fn(),
    write: jest.fn(),
  } as unknown as AccessTokenVerifyLiteCacheService;

  const useCase = new VerifyAccessTokenLiteUseCase(
    jwtTokenService,
    verifyLiteCache,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (jwtTokenService.extractBearerToken as jest.Mock).mockReturnValue('token-1');
  });

  it('returns cached identity without resolving JWT again', async () => {
    (verifyLiteCache.read as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      roles: ['user'],
      role: 'user',
      emailVerified: true,
    });

    const result = await useCase.execute('Bearer token-1');

    expect(result.userId).toBe('user-1');
    expect(jwtTokenService.resolveVerifiedLiteUserContext).not.toHaveBeenCalled();
    expect(verifyLiteCache.write).not.toHaveBeenCalled();
  });

  it('resolves lite context and writes cache on miss', async () => {
    (verifyLiteCache.read as jest.Mock).mockResolvedValue(null);
    (jwtTokenService.resolveVerifiedLiteUserContext as jest.Mock).mockResolvedValue({
      userId: 'user-2',
      roles: ['member'],
      role: 'member',
      emailVerified: false,
      workspaceId: 'ws-1',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      payload: {},
    });

    const result = await useCase.execute('Bearer token-1');

    expect(result).toEqual({
      userId: 'user-2',
      roles: ['member'],
      role: 'member',
      emailVerified: false,
      workspaceId: 'ws-1',
    });
    expect(verifyLiteCache.write).toHaveBeenCalledWith(
      'token-1',
      result,
      expect.any(Number),
    );
  });

  it('propagates inactive user errors', async () => {
    (verifyLiteCache.read as jest.Mock).mockResolvedValue(null);
    (jwtTokenService.resolveVerifiedLiteUserContext as jest.Mock).mockRejectedValue(
      new UnauthorizedException({
        code: 'USER_INACTIVE',
        message: 'User account is inactive',
      }),
    );

    await expect(useCase.execute('Bearer token-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

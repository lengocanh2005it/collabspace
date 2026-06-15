import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthGrpcService } from '../../../integrations/auth/auth-grpc.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const originalAllowDev = process.env.ALLOW_DEV_IDENTITY_HEADERS;

  afterEach(() => {
    if (originalAllowDev === undefined) {
      delete process.env.ALLOW_DEV_IDENTITY_HEADERS;
    } else {
      process.env.ALLOW_DEV_IDENTITY_HEADERS = originalAllowDev;
    }
  });

  function createContext(request: {
    headers: Record<string, string | undefined>;
  }): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('verifies JWT via auth gRPC lite and attaches user id', async () => {
    const authGrpcService = {
      verifyAccessTokenLite: jest.fn().mockResolvedValue({ userId: 'user-abc' }),
    } as unknown as AuthGrpcService;
    const guard = new AuthGuard(authGrpcService);
    const request = { headers: { authorization: 'Bearer token' } };

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(authGrpcService.verifyAccessTokenLite).toHaveBeenCalledWith('Bearer token');
    expect((request as { user?: { id: string } }).user).toEqual({ id: 'user-abc' });
  });

  it('allows dev X-User-Id header when ALLOW_DEV_IDENTITY_HEADERS is true', async () => {
    process.env.ALLOW_DEV_IDENTITY_HEADERS = 'true';
    const authGrpcService = {
      verifyAccessTokenLite: jest.fn(),
    } as unknown as AuthGrpcService;
    const guard = new AuthGuard(authGrpcService);
    const request = { headers: { 'x-user-id': 'dev-user' } };

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(authGrpcService.verifyAccessTokenLite).not.toHaveBeenCalled();
    expect((request as { user?: { id: string } }).user).toEqual({ id: 'dev-user' });
  });

  it('rejects requests without authorization or dev headers', async () => {
    const authGrpcService = {
      verifyAccessTokenLite: jest.fn(),
    } as unknown as AuthGrpcService;
    const guard = new AuthGuard(authGrpcService);

    await expect(guard.canActivate(createContext({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

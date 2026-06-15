import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthGrpcService } from '../../../integrations/auth/auth-grpc.service';
import type { AuthenticatedRequest } from '../authenticated-request';
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

  function createContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('should verify JWT and attach user from auth gRPC', async () => {
    const authGrpcService = {
      verifyAccessToken: jest.fn(),
      verifyAccessTokenLite: jest.fn().mockResolvedValue({
        emailVerified: true,
        role: 'member',
        roles: ['member'],
        userId: 'user-abc',
        workspaceId: 'workspace-1',
      }),
    } as unknown as AuthGrpcService;
    const guard = new AuthGuard(authGrpcService);

    const request = {
      headers: {
        authorization: 'Bearer token',
      },
    } as unknown as AuthenticatedRequest;

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(authGrpcService.verifyAccessTokenLite).toHaveBeenCalledWith('Bearer token');
    expect(authGrpcService.verifyAccessToken).not.toHaveBeenCalled();
    expect(request.user).toEqual({
      emailVerified: true,
      id: 'user-abc',
      role: 'member',
      roles: ['member'],
      userId: 'user-abc',
      workspaceId: 'workspace-1',
    });
  });

  it('should allow dev identity headers when explicitly enabled', async () => {
    process.env.ALLOW_DEV_IDENTITY_HEADERS = 'true';
    const authGrpcService = {
      verifyAccessToken: jest.fn(),
      verifyAccessTokenLite: jest.fn(),
    } as unknown as AuthGrpcService;
    const guard = new AuthGuard(authGrpcService);

    const request = {
      headers: {
        'x-user-id': 'dev-user',
      },
    } as unknown as AuthenticatedRequest;

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(authGrpcService.verifyAccessTokenLite).not.toHaveBeenCalled();
    expect(request.user).toEqual({
      id: 'dev-user',
      roles: [],
      userId: 'dev-user',
    });
  });

  it('should reject requests without authorization or dev headers', async () => {
    const authGrpcService = {
      verifyAccessToken: jest.fn(),
      verifyAccessTokenLite: jest.fn(),
    } as unknown as AuthGrpcService;
    const guard = new AuthGuard(authGrpcService);

    const request = { headers: {} } as unknown as AuthenticatedRequest;

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(UnauthorizedException);
  });
});

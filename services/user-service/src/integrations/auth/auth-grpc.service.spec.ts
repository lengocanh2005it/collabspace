import { UnauthorizedException } from '@nestjs/common';
import { TimeoutError, of, throwError } from 'rxjs';
import { AuthGrpcService } from './auth-grpc.service';

describe('AuthGrpcService', () => {
  const verifyAccessTokenMock = jest.fn();
  const clientMock = {
    getService: jest.fn(() => ({
      verifyAccessToken: verifyAccessTokenMock,
    })),
  };

  let service: AuthGrpcService;
  const previousTimeoutMs = process.env.AUTH_SERVICE_GRPC_TIMEOUT_MS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_SERVICE_GRPC_TIMEOUT_MS = '3000';
    service = new AuthGrpcService(clientMock as never);
    service.onModuleInit();
  });

  afterAll(() => {
    process.env.AUTH_SERVICE_GRPC_TIMEOUT_MS = previousTimeoutMs;
  });

  it('returns identity when auth-service verifies the token', async () => {
    verifyAccessTokenMock.mockReturnValue(
      of({
        authenticated: true,
        emailVerified: true,
        permissions: ['users.read'],
        role: 'member',
        roles: ['member'],
        userId: 'user-1',
        workspaceId: 'workspace-1',
      }),
    );

    await expect(
      service.verifyAccessToken('Bearer token-1'),
    ).resolves.toEqual({
      emailVerified: true,
      permissions: ['users.read'],
      role: 'member',
      roles: ['member'],
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
  });

  it('maps unauthenticated auth-service responses to UnauthorizedException', async () => {
    verifyAccessTokenMock.mockReturnValue(
      throwError(() => ({
        code: 16,
        details: 'UNAUTHENTICATED',
      })),
    );

    await expect(
      service.verifyAccessToken('Bearer invalid-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('maps timeout errors to AUTH_SERVICE_GRPC_TIMEOUT', async () => {
    verifyAccessTokenMock.mockReturnValue(
      throwError(() => new TimeoutError()),
    );

    await expect(
      service.verifyAccessToken('Bearer token-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'AUTH_SERVICE_GRPC_TIMEOUT',
      }),
    });
  });

  it('maps dependency failures to ServiceUnavailableException', async () => {
    verifyAccessTokenMock.mockReturnValue(
      throwError(() => new Error('connect ECONNREFUSED')),
    );

    await expect(
      service.verifyAccessToken('Bearer token-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'AUTH_SERVICE_GRPC_REQUEST_FAILED',
      }),
    });
  });
});

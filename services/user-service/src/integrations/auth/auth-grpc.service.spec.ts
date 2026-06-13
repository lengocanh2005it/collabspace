import { UnauthorizedException } from '@nestjs/common';
import { TimeoutError, of, throwError } from 'rxjs';
import { AuthGrpcService } from './auth-grpc.service';

describe('AuthGrpcService', () => {
  const verifyAccessTokenMock = jest.fn();
  const verifyAccessTokenLiteMock = jest.fn();
  const waitForReadyMock = jest.fn(
    (_: number, callback: (error?: Error | null) => void) => callback(null),
  );
  const clientMock = {
    getClientByServiceName: jest.fn(() => ({
      waitForReady: waitForReadyMock,
    })),
    getService: jest.fn(() => ({
      verifyAccessToken: verifyAccessTokenMock,
      verifyAccessTokenLite: verifyAccessTokenLiteMock,
    })),
  };

  let service: AuthGrpcService;
  const previousTimeoutMs = process.env.AUTH_SERVICE_GRPC_TIMEOUT_MS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_SERVICE_GRPC_TIMEOUT_MS = '3000';
    service = new AuthGrpcService(clientMock);
    service.onModuleInit();
  });

  afterAll(() => {
    process.env.AUTH_SERVICE_GRPC_TIMEOUT_MS = previousTimeoutMs;
  });

  it('returns lite identity when auth-service verifies the token', async () => {
    verifyAccessTokenLiteMock.mockReturnValue(
      of({
        authenticated: true,
        emailVerified: true,
        role: 'member',
        roles: ['member'],
        userId: 'user-1',
        workspaceId: 'workspace-1',
      }),
    );

    await expect(
      service.verifyAccessTokenLite('Bearer token-1'),
    ).resolves.toEqual({
      emailVerified: true,
      role: 'member',
      roles: ['member'],
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
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

    await expect(service.verifyAccessToken('Bearer token-1')).resolves.toEqual({
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
    verifyAccessTokenMock.mockReturnValue(throwError(() => new TimeoutError()));

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

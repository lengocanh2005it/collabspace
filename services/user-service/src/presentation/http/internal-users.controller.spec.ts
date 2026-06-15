import { UnauthorizedException } from '@nestjs/common';
import { SERVICE_IDS, SERVICE_SCOPES, signServiceJwt } from '@collabspace/shared';
import { InternalUsersController } from './internal-users.controller';

describe('InternalUsersController', () => {
  const lookupUserReplicasUseCase = {
    execute: jest.fn(),
  };

  let controller: InternalUsersController;
  const originalServiceJwtSecret = process.env.SERVICE_JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new InternalUsersController(lookupUserReplicasUseCase as never);
    process.env.NODE_ENV = 'test';
    process.env.SERVICE_JWT_SECRET = 'test-service-jwt-secret';
    lookupUserReplicasUseCase.execute.mockResolvedValue([
      { userId: 'user-1', username: 'jane.doe', isActive: true },
    ]);
  });

  afterEach(() => {
    process.env.SERVICE_JWT_SECRET = originalServiceJwtSecret;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('POST replicas returns lookup results when service JWT is valid', async () => {
    const token = signServiceJwt({
      iss: SERVICE_IDS.TASK,
      aud: SERVICE_IDS.USER,
      scope: [SERVICE_SCOPES.USER_REPLICAS_READ],
      secret: process.env.SERVICE_JWT_SECRET!,
    });

    const response = await controller.lookupReplicas(
      {
        headers: { authorization: `Bearer ${token}` },
      } as never,
      { userIds: ['user-1'], username: 'jane.doe' },
    );

    expect(lookupUserReplicasUseCase.execute).toHaveBeenCalledWith({
      userIds: ['user-1'],
      username: 'jane.doe',
    });
    expect(response).toHaveLength(1);
  });

  it('rejects requests without a valid service JWT', async () => {
    await expect(
      controller.lookupReplicas({ headers: {} } as never, {
        userIds: ['user-1'],
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

import { UnauthorizedException } from '@nestjs/common';
import { InternalUsersController } from './internal-users.controller';

describe('InternalUsersController', () => {
  const lookupUserReplicasUseCase = {
    execute: jest.fn(),
  };

  let controller: InternalUsersController;
  const originalToken = process.env.INTERNAL_SERVICE_TOKEN;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new InternalUsersController(
      lookupUserReplicasUseCase as never,
    );
    process.env.NODE_ENV = 'test';
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
    lookupUserReplicasUseCase.execute.mockResolvedValue([
      { userId: 'user-1', username: 'jane.doe', isActive: true },
    ]);
  });

  afterEach(() => {
    process.env.INTERNAL_SERVICE_TOKEN = originalToken;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('POST replicas returns lookup results when internal token is valid', async () => {
    const response = await controller.lookupReplicas(
      {
        headers: { 'x-internal-service-token': 'test-internal-token' },
      } as never,
      { userIds: ['user-1'], username: 'jane.doe' },
    );

    expect(lookupUserReplicasUseCase.execute).toHaveBeenCalledWith({
      userIds: ['user-1'],
      username: 'jane.doe',
    });
    expect(response).toHaveLength(1);
  });

  it('rejects requests without a valid internal token', async () => {
    await expect(
      controller.lookupReplicas(
        { headers: { 'x-internal-service-token': 'wrong' } } as never,
        { userIds: ['user-1'] },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});

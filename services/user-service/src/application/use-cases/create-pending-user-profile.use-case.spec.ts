jest.mock(
  '../../infrastructure/messaging/rabbitmq/rabbitmq-events.service',
  () => ({
    RabbitMqEventsService: jest.fn(),
  }),
);

import { CreatePendingUserProfileUseCase } from './create-pending-user-profile.use-case';
import {
  createUserProfileRepositoryMock,
  sampleUserProfile,
} from './testing/user-profile-repository.mock';

describe('CreatePendingUserProfileUseCase', () => {
  const rabbitMqEventsMock = {
    publishUserRegistered: jest.fn(),
  };

  let repository: ReturnType<typeof createUserProfileRepositoryMock>;
  let useCase: CreatePendingUserProfileUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = createUserProfileRepositoryMock();
    useCase = new CreatePendingUserProfileUseCase(
      repository,
      rabbitMqEventsMock as never,
    );
  });

  it('upserts pending profile and publishes user_registered event', async () => {
    jest
      .spyOn(repository, 'upsertPending')
      .mockResolvedValue(sampleUserProfile);
    rabbitMqEventsMock.publishUserRegistered.mockResolvedValue(undefined);

    await expect(
      useCase.execute({ fullName: 'Jane Doe', userId: 'user-1' }),
    ).resolves.toMatchObject({
      userId: 'user-1',
      fullName: 'Jane Doe',
      username: 'jane.doe',
    });

    expect(rabbitMqEventsMock.publishUserRegistered).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        fullName: 'Jane Doe',
        username: 'jane.doe',
      }),
    );
  });

  it('returns profile when event publish fails', async () => {
    jest
      .spyOn(repository, 'upsertPending')
      .mockResolvedValue(sampleUserProfile);
    rabbitMqEventsMock.publishUserRegistered.mockRejectedValue(
      new Error('broker down'),
    );

    await expect(
      useCase.execute({ fullName: 'Jane Doe', userId: 'user-1' }),
    ).resolves.toMatchObject({ userId: 'user-1' });
  });
});

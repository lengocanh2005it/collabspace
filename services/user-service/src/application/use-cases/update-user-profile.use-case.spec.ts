jest.mock('../../infrastructure/messaging/rabbitmq/rabbitmq-events.service', () => ({
  RabbitMqEventsService: jest.fn(),
}));

import { UpdateUserProfileUseCase } from './update-user-profile.use-case';
import {
  createUserProfileRepositoryMock,
  sampleUserProfile,
} from './testing/user-profile-repository.mock';

describe('UpdateUserProfileUseCase', () => {
  const rabbitMqEventsMock = {
    publishUserProfileUpdated: jest.fn(),
  };

  const unitOfWorkMock = {
    run: jest.fn(async (work: (context: { manager: unknown }) => Promise<unknown>) =>
      work({ manager: {} }),
    ),
  };

  const userOutboxServiceMock = {
    enqueueProfileUpdated: jest.fn(),
  };

  let repository: ReturnType<typeof createUserProfileRepositoryMock>;
  let useCase: UpdateUserProfileUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = createUserProfileRepositoryMock();
    useCase = new UpdateUserProfileUseCase(
      repository,
      unitOfWorkMock as never,
      userOutboxServiceMock as never,
      rabbitMqEventsMock as never,
    );
  });

  it('updates profile, writes outbox, and publishes user_profile_updated event', async () => {
    const updated = { ...sampleUserProfile, bio: 'Updated bio' };
    jest.spyOn(repository, 'updateProfileInTransaction').mockResolvedValue(updated);
    rabbitMqEventsMock.publishUserProfileUpdated.mockResolvedValue(undefined);
    userOutboxServiceMock.enqueueProfileUpdated.mockResolvedValue(undefined);

    await expect(useCase.execute('user-1', { bio: 'Updated bio' })).resolves.toMatchObject({
      userId: 'user-1',
      bio: 'Updated bio',
    });

    expect(repository.updateProfileInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ manager: expect.anything() }),
      'user-1',
      { bio: 'Updated bio' },
    );
    expect(userOutboxServiceMock.enqueueProfileUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        username: 'jane.doe',
        isActive: true,
      }),
      expect.anything(),
    );
    expect(rabbitMqEventsMock.publishUserProfileUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        username: 'jane.doe',
        isActive: true,
      }),
    );
  });
});

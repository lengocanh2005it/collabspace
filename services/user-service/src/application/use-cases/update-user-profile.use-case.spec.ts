jest.mock(
  '../../infrastructure/messaging/rabbitmq/rabbitmq-events.service',
  () => ({
    RabbitMqEventsService: jest.fn(),
  }),
);

import { UpdateUserProfileUseCase } from './update-user-profile.use-case';
import {
  createUserProfileRepositoryMock,
  sampleUserProfile,
} from './testing/user-profile-repository.mock';

describe('UpdateUserProfileUseCase', () => {
  const rabbitMqEventsMock = {
    publishUserProfileUpdated: jest.fn(),
  };

  let repository: ReturnType<typeof createUserProfileRepositoryMock>;
  let useCase: UpdateUserProfileUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = createUserProfileRepositoryMock();
    useCase = new UpdateUserProfileUseCase(
      repository,
      rabbitMqEventsMock as never,
    );
  });

  it('updates profile and publishes user_profile_updated event', async () => {
    const updated = { ...sampleUserProfile, bio: 'Updated bio' };
    jest.spyOn(repository, 'updateProfile').mockResolvedValue(updated);
    rabbitMqEventsMock.publishUserProfileUpdated.mockResolvedValue(undefined);

    await expect(
      useCase.execute('user-1', { bio: 'Updated bio' }),
    ).resolves.toMatchObject({
      userId: 'user-1',
      bio: 'Updated bio',
    });

    expect(rabbitMqEventsMock.publishUserProfileUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        username: 'jane.doe',
        isActive: true,
      }),
    );
  });
});

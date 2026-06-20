import { CreatePendingUserProfileUseCase } from './create-pending-user-profile.use-case';
import {
  createUserProfileRepositoryMock,
  sampleUserProfile,
} from './testing/user-profile-repository.mock';

describe('CreatePendingUserProfileUseCase', () => {
  const unitOfWorkMock = {
    run: jest.fn(async (work: (context: { manager: unknown }) => Promise<unknown>) =>
      work({ manager: {} }),
    ),
  };

  const userOutboxServiceMock = {
    enqueueUserRegistered: jest.fn(),
  };

  let repository: ReturnType<typeof createUserProfileRepositoryMock>;
  let useCase: CreatePendingUserProfileUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = createUserProfileRepositoryMock();
    useCase = new CreatePendingUserProfileUseCase(
      repository,
      unitOfWorkMock as never,
      userOutboxServiceMock as never,
    );
  });

  it('upserts pending profile and writes outbox event', async () => {
    jest.spyOn(repository, 'upsertPendingInTransaction').mockResolvedValue(sampleUserProfile);
    userOutboxServiceMock.enqueueUserRegistered.mockResolvedValue(undefined);

    await expect(
      useCase.execute({ fullName: 'Jane Doe', userId: 'user-1' }),
    ).resolves.toMatchObject({
      userId: 'user-1',
      fullName: 'Jane Doe',
      username: 'jane.doe',
    });

    expect(userOutboxServiceMock.enqueueUserRegistered).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        fullName: 'Jane Doe',
        username: 'jane.doe',
      }),
      expect.anything(),
    );
  });

  it('includes registration email in outbox payload when provided', async () => {
    jest.spyOn(repository, 'upsertPendingInTransaction').mockResolvedValue(sampleUserProfile);
    userOutboxServiceMock.enqueueUserRegistered.mockResolvedValue(undefined);

    await useCase.execute({
      fullName: 'Jane Doe',
      userId: 'user-1',
      email: 'jane@collabspace.dev',
    });

    expect(userOutboxServiceMock.enqueueUserRegistered).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        email: 'jane@collabspace.dev',
      }),
      expect.anything(),
    );
  });
});

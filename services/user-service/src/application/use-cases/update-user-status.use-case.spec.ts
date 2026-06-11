import { UpdateUserStatusUseCase } from './update-user-status.use-case';
import {
  createUserProfileRepositoryMock,
  sampleUserStatus,
} from './testing/user-profile-repository.mock';

describe('UpdateUserStatusUseCase', () => {
  let repository: ReturnType<typeof createUserProfileRepositoryMock>;
  let useCase: UpdateUserStatusUseCase;

  beforeEach(() => {
    repository = createUserProfileRepositoryMock();
    useCase = new UpdateUserStatusUseCase(repository);
  });

  it('updates status via repository', async () => {
    const updated = { ...sampleUserStatus, status: 'away', statusText: 'BRB' };
    jest.spyOn(repository, 'updateStatus').mockResolvedValue(updated);

    await expect(
      useCase.execute('user-1', { status: 'away', statusText: 'BRB' }),
    ).resolves.toMatchObject({
      userId: 'user-1',
      status: 'away',
      statusText: 'BRB',
    });
  });
});

import { GetUserStatusesUseCase } from './get-user-statuses.use-case';
import {
  createUserProfileRepositoryMock,
  sampleUserStatus,
} from './testing/user-profile-repository.mock';

describe('GetUserStatusesUseCase', () => {
  let repository: ReturnType<typeof createUserProfileRepositoryMock>;
  let useCase: GetUserStatusesUseCase;

  beforeEach(() => {
    repository = createUserProfileRepositoryMock();
    useCase = new GetUserStatusesUseCase(repository);
  });

  it('returns status DTOs for user ids', async () => {
    jest.spyOn(repository, 'getStatusesByUserIds').mockResolvedValue([sampleUserStatus]);

    await expect(useCase.execute(['user-1'])).resolves.toEqual([
      expect.objectContaining({ userId: 'user-1', status: 'online' }),
    ]);
  });
});

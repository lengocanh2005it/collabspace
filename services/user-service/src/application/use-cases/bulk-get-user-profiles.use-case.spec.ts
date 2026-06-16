import { BulkGetUserProfilesUseCase } from './bulk-get-user-profiles.use-case';
import {
  createUserProfileRepositoryMock,
  sampleUserProfile,
  sampleUserStatus,
} from './testing/user-profile-repository.mock';

describe('BulkGetUserProfilesUseCase', () => {
  let repository: ReturnType<typeof createUserProfileRepositoryMock>;
  let useCase: BulkGetUserProfilesUseCase;

  beforeEach(() => {
    repository = createUserProfileRepositoryMock();
    useCase = new BulkGetUserProfilesUseCase(repository);
  });

  it('returns mapped profiles for the requested user ids', async () => {
    jest.spyOn(repository, 'findManyByUserIds').mockResolvedValue([sampleUserProfile]);
    jest.spyOn(repository, 'getStatusesByUserIds').mockResolvedValue([sampleUserStatus]);

    await expect(useCase.execute(['user-1', 'user-2'])).resolves.toEqual([
      expect.objectContaining({ userId: 'user-1', username: 'jane.doe', status: 'online' }),
    ]);
  });

  it('returns empty array when no profiles match', async () => {
    jest.spyOn(repository, 'findManyByUserIds').mockResolvedValue([]);

    await expect(useCase.execute(['missing'])).resolves.toEqual([]);
  });
});

import { ListUserSummariesUseCase } from './list-user-summaries.use-case';
import {
  createUserProfileRepositoryMock,
  sampleUserProfile,
  sampleUserStatus,
} from './testing/user-profile-repository.mock';

describe('ListUserSummariesUseCase', () => {
  let repository: ReturnType<typeof createUserProfileRepositoryMock>;
  let useCase: ListUserSummariesUseCase;

  beforeEach(() => {
    repository = createUserProfileRepositoryMock();
    useCase = new ListUserSummariesUseCase(repository);
  });

  it('returns paginated summaries with status', async () => {
    jest.spyOn(repository, 'list').mockResolvedValue({
      items: [sampleUserProfile],
      limit: 20,
      offset: 0,
      total: 1,
    });
    jest
      .spyOn(repository, 'getStatusesByUserIds')
      .mockResolvedValue([sampleUserStatus]);

    await expect(
      useCase.execute({ q: 'jane', limit: 20, offset: 0 }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          userId: 'user-1',
          username: 'jane.doe',
          status: 'online',
        }),
      ],
      limit: 20,
      offset: 0,
      total: 1,
    });
  });
});

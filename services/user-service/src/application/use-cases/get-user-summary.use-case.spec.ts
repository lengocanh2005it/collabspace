import { NotFoundException } from '@nestjs/common';
import { GetUserSummaryUseCase } from './get-user-summary.use-case';
import {
  createUserProfileRepositoryMock,
  sampleUserProfile,
  sampleUserStatus,
} from './testing/user-profile-repository.mock';

describe('GetUserSummaryUseCase', () => {
  let repository: ReturnType<typeof createUserProfileRepositoryMock>;
  let useCase: GetUserSummaryUseCase;

  beforeEach(() => {
    repository = createUserProfileRepositoryMock();
    useCase = new GetUserSummaryUseCase(repository);
  });

  it('returns summary with status when profile exists', async () => {
    jest.spyOn(repository, 'findByUserId').mockResolvedValue(sampleUserProfile);
    jest.spyOn(repository, 'getStatus').mockResolvedValue(sampleUserStatus);

    await expect(useCase.execute('user-1')).resolves.toMatchObject({
      userId: 'user-1',
      username: 'jane.doe',
      status: 'online',
    });
  });

  it('throws not found when profile is missing or deleted', async () => {
    jest.spyOn(repository, 'findByUserId').mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });
});

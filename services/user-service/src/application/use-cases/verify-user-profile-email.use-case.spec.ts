import { NotFoundException } from '@nestjs/common';
import { VerifyUserProfileEmailUseCase } from './verify-user-profile-email.use-case';
import {
  createUserProfileRepositoryMock,
  sampleUserProfile,
} from './testing/user-profile-repository.mock';

describe('VerifyUserProfileEmailUseCase', () => {
  let repository: ReturnType<typeof createUserProfileRepositoryMock>;
  let useCase: VerifyUserProfileEmailUseCase;

  beforeEach(() => {
    repository = createUserProfileRepositoryMock();
    useCase = new VerifyUserProfileEmailUseCase(repository);
  });

  it('returns profile when user exists', async () => {
    jest.spyOn(repository, 'findByUserId').mockResolvedValue(sampleUserProfile);

    await expect(useCase.execute('user-1')).resolves.toMatchObject({
      userId: 'user-1',
      username: 'jane.doe',
    });
  });

  it('throws USER_NOT_FOUND when profile is missing', async () => {
    jest.spyOn(repository, 'findByUserId').mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toMatchObject({
      response: { code: 'USER_NOT_FOUND' },
    });
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });
});

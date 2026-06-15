import { GetUserPreferencesUseCase } from './get-user-preferences.use-case';
import {
  createUserProfileRepositoryMock,
  sampleUserPreferences,
} from './testing/user-profile-repository.mock';

describe('GetUserPreferencesUseCase', () => {
  let repository: ReturnType<typeof createUserProfileRepositoryMock>;
  let useCase: GetUserPreferencesUseCase;

  beforeEach(() => {
    repository = createUserProfileRepositoryMock();
    useCase = new GetUserPreferencesUseCase(repository);
  });

  it('returns preferences response dto', async () => {
    jest.spyOn(repository, 'getPreferences').mockResolvedValue(sampleUserPreferences);

    await expect(useCase.execute('user-1')).resolves.toMatchObject({
      userId: 'user-1',
      language: 'en',
      theme: 'system',
    });
  });
});

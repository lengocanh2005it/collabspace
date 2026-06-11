import { UpdateUserPreferencesUseCase } from './update-user-preferences.use-case';
import {
  createUserProfileRepositoryMock,
  sampleUserPreferences,
} from './testing/user-profile-repository.mock';

describe('UpdateUserPreferencesUseCase', () => {
  let repository: ReturnType<typeof createUserProfileRepositoryMock>;
  let useCase: UpdateUserPreferencesUseCase;

  beforeEach(() => {
    repository = createUserProfileRepositoryMock();
    useCase = new UpdateUserPreferencesUseCase(repository);
  });

  it('updates preferences via repository', async () => {
    const updated = { ...sampleUserPreferences, theme: 'dark' };
    jest.spyOn(repository, 'updatePreferences').mockResolvedValue(updated);

    await expect(
      useCase.execute('user-1', { theme: 'dark' }),
    ).resolves.toMatchObject({
      userId: 'user-1',
      theme: 'dark',
    });
  });
});

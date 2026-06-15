import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import type { AuthAdminHttpClient } from '../../integrations/auth/auth-admin-http.client';
import { ManageUsersAdminUseCase } from './manage-users-admin.use-case';

describe('ManageUsersAdminUseCase', () => {
  const repository = {
    anonymize: jest.fn(),
    list: jest.fn(),
  } as unknown as jest.Mocked<UserProfileRepository>;
  const authClient = {
    deactivateUser: jest.fn(),
    listUsers: jest.fn(),
  } as unknown as jest.Mocked<AuthAdminHttpClient>;
  const useCase = new ManageUsersAdminUseCase(repository, authClient);

  beforeEach(() => jest.clearAllMocks());

  it('hydrates auth accounts with profile fields', async () => {
    authClient.listUsers.mockResolvedValue([
      {
        id: 'user-1',
        email: 'user@example.com',
        emailVerified: true,
        isActive: true,
        roles: ['member'],
      },
    ]);
    repository.list.mockResolvedValue({
      items: [
        {
          userId: 'user-1',
          fullName: 'User One',
          username: 'user.one',
        },
      ],
      total: 1,
    });

    const result = await useCase.list('Bearer admin');

    expect(result[0]).toMatchObject({
      email: 'user@example.com',
      fullName: 'User One',
      username: 'user.one',
    });
  });

  it('anonymizes the profile and deactivates the auth account', async () => {
    await useCase.anonymize('admin-1', 'user-1', 'Bearer admin');

    expect(repository.anonymize).toHaveBeenCalledWith('user-1');
    expect(authClient.deactivateUser).toHaveBeenCalledWith('user-1', 'Bearer admin');
  });
});

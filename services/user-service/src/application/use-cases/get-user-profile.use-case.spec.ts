import { NotFoundException } from '@nestjs/common';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import { GetUserProfileUseCase } from './get-user-profile.use-case';

describe('GetUserProfileUseCase', () => {
  const userProfileRepositoryMock: UserProfileRepository = {
    findByUserId: jest.fn(),
  };

  let getUserProfileUseCase: GetUserProfileUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    getUserProfileUseCase = new GetUserProfileUseCase(userProfileRepositoryMock);
  });

  it('returns a user profile response dto when profile exists', async () => {
    jest.spyOn(userProfileRepositoryMock, 'findByUserId').mockResolvedValue({
      avatarUrl: 'https://cdn.example.com/avatar-1.png',
      bio: 'Product designer',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null,
      fullName: 'Jane Doe',
      id: 'profile-1',
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      userId: 'user-1',
    });

    await expect(getUserProfileUseCase.execute('user-1')).resolves.toEqual({
      avatarUrl: 'https://cdn.example.com/avatar-1.png',
      bio: 'Product designer',
      createdAt: '2026-01-01T00:00:00.000Z',
      fullName: 'Jane Doe',
      id: 'profile-1',
      updatedAt: '2026-01-02T00:00:00.000Z',
      userId: 'user-1',
    });
  });

  it('throws not found when profile does not exist', async () => {
    jest.spyOn(userProfileRepositoryMock, 'findByUserId').mockResolvedValue(
      null,
    );

    await expect(getUserProfileUseCase.execute('missing-user')).rejects.toThrow(
      NotFoundException,
    );
  });
});

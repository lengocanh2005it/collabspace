import { LookupUserReplicasUseCase } from './lookup-user-replicas.use-case';

describe('LookupUserReplicasUseCase', () => {
  it('returns replica DTOs by userId and username', async () => {
    const profile = {
      userId: 'user-1',
      username: 'jane.doe',
      fullName: 'Jane Doe',
      displayName: 'Jane',
      avatarUrl: null,
      deletedAt: null,
    };

    const repository = {
      findByUsername: jest.fn().mockResolvedValue(profile),
      findManyByUserIds: jest.fn().mockResolvedValue([profile]),
    };

    const useCase = new LookupUserReplicasUseCase(repository as never);
    const result = await useCase.execute({
      userIds: ['user-1'],
      username: 'jane.doe',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: 'user-1',
      username: 'jane.doe',
      isActive: true,
    });
  });
});

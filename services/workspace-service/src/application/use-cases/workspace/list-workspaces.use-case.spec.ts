import { Test, TestingModule } from '@nestjs/testing';
import { ListWorkspacesUseCase } from './list-workspaces.use-case';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';

describe('ListWorkspacesUseCase', () => {
  let useCase: ListWorkspacesUseCase;

  const mockQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([{ id: 'ws-1' }]),
  };

  const mockWorkspaceRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListWorkspacesUseCase,
        {
          provide: getRepositoryToken(WorkspaceOrmEntity),
          useValue: mockWorkspaceRepo,
        },
      ],
    }).compile();

    useCase = module.get<ListWorkspacesUseCase>(ListWorkspacesUseCase);
  });

  it('should list workspaces using inner join on members', async () => {
    const result = await useCase.execute('user-1');
    expect(mockWorkspaceRepo.createQueryBuilder).toHaveBeenCalledWith(
      'workspace',
    );
    expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
      'workspace.members',
      'member',
      'member.user_id = :userId',
      { userId: 'user-1' },
    );
    expect(result).toEqual([{ id: 'ws-1' }]);
  });
});

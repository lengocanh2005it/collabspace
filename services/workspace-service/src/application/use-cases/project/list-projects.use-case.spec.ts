import { Test, TestingModule } from '@nestjs/testing';
import { ListProjectsUseCase } from './list-projects.use-case';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectOrmEntity } from '../../../infrastructure/database/entities/project.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { ForbiddenException } from '@nestjs/common';

describe('ListProjectsUseCase', () => {
  let useCase: ListProjectsUseCase;

  const mockProjectRepo = {
    find: jest.fn(),
  };

  const mockMemberRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListProjectsUseCase,
        {
          provide: getRepositoryToken(ProjectOrmEntity),
          useValue: mockProjectRepo,
        },
        {
          provide: getRepositoryToken(WorkspaceMemberOrmEntity),
          useValue: mockMemberRepo,
        },
      ],
    }).compile();

    useCase = module.get<ListProjectsUseCase>(ListProjectsUseCase);
  });

  it('should throw ForbiddenException if user is not a member', async () => {
    mockMemberRepo.findOne.mockResolvedValue(null);
    await expect(useCase.execute('user-1', 'ws-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should return projects if user is a member', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'member' });
    mockProjectRepo.find.mockResolvedValue([{ id: 'proj-1' }]);
    const result = await useCase.execute('user-1', 'ws-1');
    expect(result).toEqual([{ id: 'proj-1' }]);
  });
});

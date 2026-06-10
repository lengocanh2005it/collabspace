import { Test, TestingModule } from '@nestjs/testing';
import { DeleteProjectUseCase } from './delete-project.use-case';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectOrmEntity } from '../../../infrastructure/database/entities/project.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('DeleteProjectUseCase', () => {
  let useCase: DeleteProjectUseCase;

  const mockProjectRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockMemberRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteProjectUseCase,
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

    useCase = module.get<DeleteProjectUseCase>(DeleteProjectUseCase);
  });

  it('should throw ForbiddenException if user is not owner or admin', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'member' });
    await expect(useCase.execute('user-1', 'ws-1', 'proj-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw NotFoundException if project does not exist', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'admin' });
    mockProjectRepo.findOne.mockResolvedValue(null);
    await expect(useCase.execute('user-1', 'ws-1', 'proj-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should soft delete project if allowed', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'owner' });
    const project = { id: 'proj-1', is_deleted: false };
    mockProjectRepo.findOne.mockResolvedValue(project);
    const result = await useCase.execute('user-1', 'ws-1', 'proj-1');
    expect(project.is_deleted).toBe(true);
    expect(mockProjectRepo.save).toHaveBeenCalledWith(project);
    expect(result).toEqual({ status: 'deleted' });
  });
});

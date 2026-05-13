import { Test, TestingModule } from '@nestjs/testing';
import { GetWorkspaceUseCase } from './get-workspace.use-case';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('GetWorkspaceUseCase', () => {
  let useCase: GetWorkspaceUseCase;

  const mockWorkspaceRepo = {
    findOne: jest.fn(),
  };

  const mockMemberRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetWorkspaceUseCase,
        {
          provide: getRepositoryToken(WorkspaceOrmEntity),
          useValue: mockWorkspaceRepo,
        },
        {
          provide: getRepositoryToken(WorkspaceMemberOrmEntity),
          useValue: mockMemberRepo,
        },
      ],
    }).compile();

    useCase = module.get<GetWorkspaceUseCase>(GetWorkspaceUseCase);
  });

  it('should throw ForbiddenException if user is not a member', async () => {
    mockMemberRepo.findOne.mockResolvedValue(null);
    await expect(useCase.execute('user-1', 'workspace-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw NotFoundException if workspace does not exist', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'member' });
    mockWorkspaceRepo.findOne.mockResolvedValue(null);
    await expect(useCase.execute('user-1', 'workspace-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should return workspace if user is member and workspace exists', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'member' });
    mockWorkspaceRepo.findOne.mockResolvedValue({
      id: 'workspace-1',
      name: 'Test',
    });
    const result = await useCase.execute('user-1', 'workspace-1');
    expect(result).toEqual({ id: 'workspace-1', name: 'Test' });
  });
});

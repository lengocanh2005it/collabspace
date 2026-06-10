import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CheckWorkspaceMembershipUseCase } from './check-workspace-membership.use-case';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';

describe('CheckWorkspaceMembershipUseCase', () => {
  let useCase: CheckWorkspaceMembershipUseCase;

  const mockWorkspaceRepo = {
    findOne: jest.fn(),
  };

  const mockMemberRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckWorkspaceMembershipUseCase,
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

    useCase = module.get(CheckWorkspaceMembershipUseCase);
    jest.clearAllMocks();
  });

  it('should throw NotFoundException when workspace does not exist', async () => {
    mockWorkspaceRepo.findOne.mockResolvedValue(null);

    await expect(
      useCase.execute('550e8400-e29b-41d4-a716-446655440000', 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return isMember false when user is not a member', async () => {
    mockWorkspaceRepo.findOne.mockResolvedValue({ id: 'workspace-1' });
    mockMemberRepo.findOne.mockResolvedValue(null);

    await expect(
      useCase.execute('550e8400-e29b-41d4-a716-446655440000', 'user-1'),
    ).resolves.toEqual({
      workspaceId: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-1',
      isMember: false,
      role: null,
    });
  });

  it('should return membership role when user is a member', async () => {
    mockWorkspaceRepo.findOne.mockResolvedValue({ id: 'workspace-1' });
    mockMemberRepo.findOne.mockResolvedValue({ role: 'admin' });

    await expect(
      useCase.execute('550e8400-e29b-41d4-a716-446655440000', 'user-1'),
    ).resolves.toEqual({
      workspaceId: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-1',
      isMember: true,
      role: 'admin',
    });
  });
});

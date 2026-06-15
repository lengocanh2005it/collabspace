import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CheckWorkspaceMembershipUseCase } from './check-workspace-membership.use-case';
import { WORKSPACE_REPOSITORY } from '../../../domain/repositories/workspace.repository';
import { WORKSPACE_MEMBER_REPOSITORY } from '../../../domain/repositories/workspace-member.repository';
import { Workspace } from '../../../domain/entities/workspace.entity';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';

describe('CheckWorkspaceMembershipUseCase', () => {
  let useCase: CheckWorkspaceMembershipUseCase;

  const mockWorkspaceRepo = { findById: jest.fn() };
  const mockMemberRepo = { findByWorkspaceAndUser: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckWorkspaceMembershipUseCase,
        { provide: WORKSPACE_REPOSITORY, useValue: mockWorkspaceRepo },
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: mockMemberRepo },
      ],
    }).compile();
    useCase = module.get(CheckWorkspaceMembershipUseCase);
  });

  it('should throw NotFoundException when workspace does not exist', async () => {
    mockWorkspaceRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('ws-1', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('should return isMember false when user is not a member', async () => {
    mockWorkspaceRepo.findById.mockResolvedValue(
      new Workspace('ws-1', 'Test', null, 'user-1', new Date(), new Date()),
    );
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(null);
    await expect(useCase.execute('ws-1', 'user-1')).resolves.toEqual({
      workspaceId: 'ws-1',
      userId: 'user-1',
      isMember: false,
      role: null,
    });
  });

  it('should return membership role when user is a member', async () => {
    mockWorkspaceRepo.findById.mockResolvedValue(
      new Workspace('ws-1', 'Test', null, 'user-1', new Date(), new Date()),
    );
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'admin', new Date()),
    );
    await expect(useCase.execute('ws-1', 'user-1')).resolves.toEqual({
      workspaceId: 'ws-1',
      userId: 'user-1',
      isMember: true,
      role: 'admin',
    });
  });
});

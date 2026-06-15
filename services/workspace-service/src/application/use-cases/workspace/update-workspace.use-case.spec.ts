import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UpdateWorkspaceUseCase } from './update-workspace.use-case';
import { WORKSPACE_REPOSITORY } from '../../../domain/repositories/workspace.repository';
import { WORKSPACE_MEMBER_REPOSITORY } from '../../../domain/repositories/workspace-member.repository';
import { Workspace } from '../../../domain/entities/workspace.entity';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';

describe('UpdateWorkspaceUseCase', () => {
  let useCase: UpdateWorkspaceUseCase;

  const mockWorkspaceRepo = { findById: jest.fn(), update: jest.fn() };
  const mockMemberRepo = { findByWorkspaceAndUser: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateWorkspaceUseCase,
        { provide: WORKSPACE_REPOSITORY, useValue: mockWorkspaceRepo },
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: mockMemberRepo },
      ],
    }).compile();
    useCase = module.get<UpdateWorkspaceUseCase>(UpdateWorkspaceUseCase);
  });

  it('should throw ForbiddenException if user is not owner or admin', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'member', new Date()),
    );
    await expect(useCase.execute('user-1', 'ws-1', { name: 'New' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw NotFoundException if workspace does not exist', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'admin', new Date()),
    );
    mockWorkspaceRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('user-1', 'ws-1', { name: 'New' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should call update and return result if allowed', async () => {
    const updated = new Workspace('ws-1', 'New Name', null, 'user-1', new Date(), new Date());
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'owner', new Date()),
    );
    mockWorkspaceRepo.findById.mockResolvedValue(
      new Workspace('ws-1', 'Old', null, 'user-1', new Date(), new Date()),
    );
    mockWorkspaceRepo.update.mockResolvedValue(updated);

    const result = await useCase.execute('user-1', 'ws-1', {
      name: 'New Name',
    });
    expect(mockWorkspaceRepo.update).toHaveBeenCalledWith('ws-1', {
      name: 'New Name',
      description: undefined,
    });
    expect(result).toBe(updated);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetWorkspaceUseCase } from './get-workspace.use-case';
import { WORKSPACE_REPOSITORY } from '../../../domain/repositories/workspace.repository';
import { WORKSPACE_MEMBER_REPOSITORY } from '../../../domain/repositories/workspace-member.repository';
import { Workspace } from '../../../domain/entities/workspace.entity';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';

describe('GetWorkspaceUseCase', () => {
  let useCase: GetWorkspaceUseCase;

  const mockWorkspaceRepo = { findById: jest.fn() };
  const mockMemberRepo = { findByWorkspaceAndUser: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetWorkspaceUseCase,
        { provide: WORKSPACE_REPOSITORY, useValue: mockWorkspaceRepo },
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: mockMemberRepo },
      ],
    }).compile();
    useCase = module.get<GetWorkspaceUseCase>(GetWorkspaceUseCase);
  });

  it('should throw ForbiddenException if user is not a member', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(null);
    await expect(useCase.execute('user-1', 'ws-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw NotFoundException if workspace does not exist', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'member', new Date()),
    );
    mockWorkspaceRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('user-1', 'ws-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should return workspace if user is member and workspace exists', async () => {
    const ws = new Workspace(
      'ws-1',
      'Test',
      null,
      'user-1',
      new Date(),
      new Date(),
    );
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'member', new Date()),
    );
    mockWorkspaceRepo.findById.mockResolvedValue(ws);
    const result = await useCase.execute('user-1', 'ws-1');
    expect(result).toBe(ws);
  });
});

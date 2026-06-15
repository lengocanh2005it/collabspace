import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { GetWorkspaceActivityUseCase } from './get-workspace-activity.use-case';
import { WORKSPACE_ACTIVITY_REPOSITORY } from '../../../domain/repositories/workspace-activity.repository';
import { WORKSPACE_MEMBER_REPOSITORY } from '../../../domain/repositories/workspace-member.repository';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';

describe('GetWorkspaceActivityUseCase', () => {
  let useCase: GetWorkspaceActivityUseCase;

  const mockActivityRepo = { findByWorkspace: jest.fn() };
  const mockMemberRepo = { findByWorkspaceAndUser: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetWorkspaceActivityUseCase,
        { provide: WORKSPACE_ACTIVITY_REPOSITORY, useValue: mockActivityRepo },
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: mockMemberRepo },
      ],
    }).compile();
    useCase = module.get<GetWorkspaceActivityUseCase>(GetWorkspaceActivityUseCase);
  });

  it('throws ForbiddenException when requester is not a workspace member', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'ws-1')).rejects.toThrow(ForbiddenException);
  });

  it('returns workspace activity for members', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const activities = [
      {
        id: 'act-1',
        workspaceId: 'ws-1',
        actorId: 'user-1',
        type: 'workspace.updated',
        payload: { name: 'Demo' },
        createdAt,
      },
    ];

    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('member-1', 'ws-1', 'user-1', 'member', createdAt),
    );
    mockActivityRepo.findByWorkspace.mockResolvedValue(activities);

    const result = await useCase.execute('user-1', 'ws-1', {
      limit: 10,
      offset: 0,
    });

    expect(mockMemberRepo.findByWorkspaceAndUser).toHaveBeenCalledWith('ws-1', 'user-1');
    expect(mockActivityRepo.findByWorkspace).toHaveBeenCalledWith('ws-1', {
      limit: 10,
      offset: 0,
    });
    expect(result).toEqual(activities);
  });
});

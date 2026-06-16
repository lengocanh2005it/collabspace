import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { InviteMemberUseCase } from './invite-member.use-case';
import { WORKSPACE_REPOSITORY } from '../../../domain/repositories/workspace.repository';
import { WORKSPACE_MEMBER_REPOSITORY } from '../../../domain/repositories/workspace-member.repository';
import { INVITATION_REPOSITORY } from '../../../domain/repositories/invitation.repository';
import { WORKSPACE_ACTIVITY_REPOSITORY } from '../../../domain/repositories/workspace-activity.repository';
import { Workspace } from '../../../domain/entities/workspace.entity';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';
import { Invitation } from '../../../domain/entities/invitation.entity';

describe('InviteMemberUseCase', () => {
  let useCase: InviteMemberUseCase;

  const mockMemberRepo = { findByWorkspaceAndUser: jest.fn() };
  const mockWorkspaceRepo = { findById: jest.fn() };
  const mockInvitationRepo = { createAndPublishInvited: jest.fn() };
  const mockActivityRepo = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteMemberUseCase,
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: mockMemberRepo },
        { provide: WORKSPACE_REPOSITORY, useValue: mockWorkspaceRepo },
        { provide: INVITATION_REPOSITORY, useValue: mockInvitationRepo },
        { provide: WORKSPACE_ACTIVITY_REPOSITORY, useValue: mockActivityRepo },
      ],
    }).compile();
    useCase = module.get<InviteMemberUseCase>(InviteMemberUseCase);
  });

  it('should throw ForbiddenException if user is not the workspace owner', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'member', new Date()),
    );
    await expect(useCase.execute('user-1', 'ws-1', { email: 'test@example.com' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should create invitation via repository if allowed', async () => {
    const invitation = new Invitation(
      'inv-1',
      'ws-1',
      'user-1',
      'test@example.com',
      null,
      'pending',
      new Date(),
      new Date(),
    );
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'owner', new Date()),
    );
    mockWorkspaceRepo.findById.mockResolvedValue(
      new Workspace('ws-1', 'Test WS', null, 'user-1', new Date(), new Date()),
    );
    mockInvitationRepo.createAndPublishInvited.mockResolvedValue(invitation);

    const result = await useCase.execute('user-1', 'ws-1', {
      email: 'test@example.com',
    });
    expect(mockInvitationRepo.createAndPublishInvited).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      inviterId: 'user-1',
      inviteeEmail: 'test@example.com',
      workspaceName: 'Test WS',
    });
    expect(result).toBe(invitation);
  });
});

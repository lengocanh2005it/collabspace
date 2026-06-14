import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ListInvitationsUseCase } from './list-invitations.use-case';
import { INVITATION_REPOSITORY } from '../../../domain/repositories/invitation.repository';
import { WORKSPACE_MEMBER_REPOSITORY } from '../../../domain/repositories/workspace-member.repository';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';
import { Invitation } from '../../../domain/entities/invitation.entity';

describe('ListInvitationsUseCase', () => {
  let useCase: ListInvitationsUseCase;

  const mockInvitationRepo = { findPendingByWorkspace: jest.fn() };
  const mockMemberRepo = { findByWorkspaceAndUser: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListInvitationsUseCase,
        { provide: INVITATION_REPOSITORY, useValue: mockInvitationRepo },
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: mockMemberRepo },
      ],
    }).compile();
    useCase = module.get<ListInvitationsUseCase>(ListInvitationsUseCase);
  });

  it('should throw ForbiddenException if requester is not a workspace member', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'ws-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should list pending invitations for workspace members', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const expiresAt = new Date('2026-01-08T00:00:00.000Z');
    const invitations = [
      new Invitation(
        'inv-1',
        'ws-1',
        'owner-1',
        'member@example.com',
        null,
        'pending',
        createdAt,
        expiresAt,
      ),
    ];

    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('member-1', 'ws-1', 'user-1', 'member', createdAt),
    );
    mockInvitationRepo.findPendingByWorkspace.mockResolvedValue(invitations);

    const result = await useCase.execute('user-1', 'ws-1');

    expect(mockMemberRepo.findByWorkspaceAndUser).toHaveBeenCalledWith(
      'ws-1',
      'user-1',
    );
    expect(mockInvitationRepo.findPendingByWorkspace).toHaveBeenCalledWith(
      'ws-1',
    );
    expect(result).toEqual([
      {
        id: 'inv-1',
        workspaceId: 'ws-1',
        inviterId: 'owner-1',
        inviteeEmail: 'member@example.com',
        inviteeUserId: null,
        status: 'pending',
        createdAt,
        expiresAt,
      },
    ]);
  });
});

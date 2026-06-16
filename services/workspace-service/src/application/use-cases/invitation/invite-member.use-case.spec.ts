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
import { AuthHttpClient } from '../../../integrations/auth/auth-http.client';

describe('InviteMemberUseCase', () => {
  let useCase: InviteMemberUseCase;

  const mockMemberRepo = {
    findByWorkspaceAndUser: jest.fn(),
  };
  const mockWorkspaceRepo = { findById: jest.fn() };
  const mockInvitationRepo = {
    createAndPublishInvited: jest.fn(),
    findPendingByWorkspaceAndEmail: jest.fn(),
  };
  const mockActivityRepo = { record: jest.fn().mockResolvedValue(undefined) };
  const mockAuthHttpClient = { lookupAccountByEmail: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockInvitationRepo.findPendingByWorkspaceAndEmail.mockResolvedValue(null);
    mockAuthHttpClient.lookupAccountByEmail.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteMemberUseCase,
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: mockMemberRepo },
        { provide: WORKSPACE_REPOSITORY, useValue: mockWorkspaceRepo },
        { provide: INVITATION_REPOSITORY, useValue: mockInvitationRepo },
        { provide: WORKSPACE_ACTIVITY_REPOSITORY, useValue: mockActivityRepo },
        { provide: AuthHttpClient, useValue: mockAuthHttpClient },
      ],
    }).compile();
    useCase = module.get<InviteMemberUseCase>(InviteMemberUseCase);
  });

  it('should throw ForbiddenException if user is not the workspace owner/manager', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'member', new Date()),
    );
    await expect(useCase.execute('user-1', 'ws-1', { email: 'test@example.com' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows workspace manager to create invitation', async () => {
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
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'manager', new Date()),
    );
    mockWorkspaceRepo.findById.mockResolvedValue(
      new Workspace('ws-1', 'Test WS', null, 'user-1', new Date(), new Date()),
    );
    mockInvitationRepo.createAndPublishInvited.mockResolvedValue(invitation);

    const result = await useCase.execute('user-1', 'ws-1', { email: 'test@example.com' });

    expect(result).toBe(invitation);
    expect(mockInvitationRepo.createAndPublishInvited).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      inviterId: 'user-1',
      inviteeEmail: 'test@example.com',
      workspaceName: 'Test WS',
    });
  });

  it('rejects duplicate pending invitations for the same email', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'owner', new Date()),
    );
    mockInvitationRepo.findPendingByWorkspaceAndEmail.mockResolvedValue(
      new Invitation(
        'inv-1',
        'ws-1',
        'user-1',
        'test@example.com',
        null,
        'pending',
        new Date(),
        new Date(),
      ),
    );

    await expect(
      useCase.execute('user-1', 'ws-1', { email: 'test@example.com' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITE_ALREADY_PENDING' }),
    });
  });

  it('rejects inviting a platform admin account', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'owner', new Date()),
    );
    mockAuthHttpClient.lookupAccountByEmail.mockResolvedValue({
      userId: 'admin-1',
      email: 'tho@collabspace.dev',
      roles: ['admin'],
      permissions: [],
    });

    await expect(
      useCase.execute('user-1', 'ws-1', { email: 'tho@collabspace.dev' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITE_PLATFORM_ADMIN' }),
    });
  });

  it('rejects inviting someone who is already a workspace member', async () => {
    mockMemberRepo.findByWorkspaceAndUser
      .mockResolvedValueOnce(new WorkspaceMember('m-1', 'ws-1', 'user-1', 'owner', new Date()))
      .mockResolvedValueOnce(new WorkspaceMember('m-2', 'ws-1', 'user-2', 'member', new Date()));
    mockAuthHttpClient.lookupAccountByEmail.mockResolvedValue({
      userId: 'user-2',
      email: 'member@collabspace.dev',
      roles: ['user'],
      permissions: [],
    });

    await expect(
      useCase.execute('user-1', 'ws-1', { email: 'member@collabspace.dev' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVITE_ALREADY_MEMBER' }),
    });
  });
});

import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AcceptInvitationUseCase } from './accept-invitation.use-case';
import { INVITATION_REPOSITORY } from '../../../domain/repositories/invitation.repository';
import { WORKSPACE_ACTIVITY_REPOSITORY } from '../../../domain/repositories/workspace-activity.repository';
import { AuthHttpClient } from '../../../integrations/auth/auth-http.client';
import { Invitation } from '../../../domain/entities/invitation.entity';

describe('AcceptInvitationUseCase', () => {
  let useCase: AcceptInvitationUseCase;

  const mockInvitationRepo = {
    findById: jest.fn(),
    acceptAndJoinWorkspace: jest.fn(),
  };
  const mockActivityRepo = { record: jest.fn().mockResolvedValue(undefined) };
  const mockAuthHttpClient = {
    getCurrentUserAccount: jest.fn().mockResolvedValue({
      userId: 'user-2',
      email: 'invitee@example.com',
      roles: ['user'],
      permissions: [],
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcceptInvitationUseCase,
        { provide: INVITATION_REPOSITORY, useValue: mockInvitationRepo },
        { provide: WORKSPACE_ACTIVITY_REPOSITORY, useValue: mockActivityRepo },
        { provide: AuthHttpClient, useValue: mockAuthHttpClient },
      ],
    }).compile();
    useCase = module.get<AcceptInvitationUseCase>(AcceptInvitationUseCase);
  });

  it('should delegate to repository and return result', async () => {
    const expected = { memberJoined: true, status: 'accepted', workspaceId: 'ws-1' };
    mockInvitationRepo.findById.mockResolvedValue(
      new Invitation(
        'inv-1',
        'ws-1',
        'u-1',
        'invitee@example.com',
        'user-2',
        'pending',
        new Date(),
        new Date(Date.now() + 86_400_000),
      ),
    );
    mockInvitationRepo.acceptAndJoinWorkspace.mockResolvedValue(expected);

    const result = await useCase.execute('user-2', 'inv-1');
    expect(mockInvitationRepo.acceptAndJoinWorkspace).toHaveBeenCalledWith('inv-1', 'user-2');
    expect(mockActivityRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-2',
        type: 'member_joined',
        workspaceId: 'ws-1',
      }),
    );
    expect(result).toEqual({ status: 'accepted', workspaceId: 'ws-1' });
  });

  it('does not record duplicate member_joined activity for idempotent accepts', async () => {
    mockInvitationRepo.findById.mockResolvedValue(
      new Invitation(
        'inv-1',
        'ws-1',
        'u-1',
        'invitee@example.com',
        'user-2',
        'accepted',
        new Date(),
        new Date(Date.now() + 86_400_000),
      ),
    );
    mockInvitationRepo.acceptAndJoinWorkspace.mockResolvedValue({
      memberJoined: false,
      status: 'accepted',
      workspaceId: 'ws-1',
    });

    const result = await useCase.execute('user-2', 'inv-1');

    expect(mockActivityRepo.record).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'accepted', workspaceId: 'ws-1' });
  });

  it('rejects platform admin accounts', async () => {
    mockInvitationRepo.findById.mockResolvedValue(
      new Invitation(
        'inv-1',
        'ws-1',
        'u-1',
        'admin@collabspace.dev',
        'admin-1',
        'pending',
        new Date(),
        new Date(Date.now() + 86_400_000),
      ),
    );
    mockAuthHttpClient.getCurrentUserAccount.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@collabspace.dev',
      roles: ['admin'],
      permissions: [],
    });

    await expect(useCase.execute('admin-1', 'inv-1')).rejects.toThrow(BadRequestException);
    expect(mockInvitationRepo.acceptAndJoinWorkspace).not.toHaveBeenCalled();
  });
});

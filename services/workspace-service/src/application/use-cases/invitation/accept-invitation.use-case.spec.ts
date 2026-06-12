import { Test, TestingModule } from '@nestjs/testing';
import { AcceptInvitationUseCase } from './accept-invitation.use-case';
import { INVITATION_REPOSITORY } from '../../../domain/repositories/invitation.repository';
import { WORKSPACE_ACTIVITY_REPOSITORY } from '../../../domain/repositories/workspace-activity.repository';

describe('AcceptInvitationUseCase', () => {
  let useCase: AcceptInvitationUseCase;

  const mockInvitationRepo = { acceptAndJoinWorkspace: jest.fn() };
  const mockActivityRepo = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcceptInvitationUseCase,
        { provide: INVITATION_REPOSITORY, useValue: mockInvitationRepo },
        { provide: WORKSPACE_ACTIVITY_REPOSITORY, useValue: mockActivityRepo },
      ],
    }).compile();
    useCase = module.get<AcceptInvitationUseCase>(AcceptInvitationUseCase);
  });

  it('should delegate to repository and return result', async () => {
    const expected = { status: 'accepted', workspaceId: 'ws-1' };
    mockInvitationRepo.acceptAndJoinWorkspace.mockResolvedValue(expected);

    const result = await useCase.execute('user-2', 'inv-1');
    expect(mockInvitationRepo.acceptAndJoinWorkspace).toHaveBeenCalledWith(
      'inv-1',
      'user-2',
    );
    expect(result).toBe(expected);
  });
});

import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RejectInvitationUseCase } from './reject-invitation.use-case';
import { INVITATION_REPOSITORY } from '../../../domain/repositories/invitation.repository';
import { WORKSPACE_ACTIVITY_REPOSITORY } from '../../../domain/repositories/workspace-activity.repository';
import { AuthHttpClient } from '../../../integrations/auth/auth-http.client';
import { Invitation } from '../../../domain/entities/invitation.entity';

describe('RejectInvitationUseCase', () => {
  let useCase: RejectInvitationUseCase;

  const mockInvitationRepo = {
    findById: jest.fn(),
    updateStatus: jest.fn(),
  };
  const mockActivityRepo = { record: jest.fn().mockResolvedValue(undefined) };
  const mockAuthHttpClient = {
    getCurrentUserAccount: jest.fn().mockResolvedValue({
      userId: 'user-2',
      email: 'a@b.com',
      roles: ['user'],
      permissions: [],
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RejectInvitationUseCase,
        { provide: INVITATION_REPOSITORY, useValue: mockInvitationRepo },
        { provide: WORKSPACE_ACTIVITY_REPOSITORY, useValue: mockActivityRepo },
        { provide: AuthHttpClient, useValue: mockAuthHttpClient },
      ],
    }).compile();
    useCase = module.get<RejectInvitationUseCase>(RejectInvitationUseCase);
  });

  it('should throw NotFoundException if invitation not found', async () => {
    mockInvitationRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('user-2', 'inv-1')).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if not pending', async () => {
    mockInvitationRepo.findById.mockResolvedValue(
      new Invitation('inv-1', 'ws-1', 'u-1', 'a@b.com', null, 'accepted', new Date(), new Date()),
    );
    await expect(useCase.execute('user-2', 'inv-1')).rejects.toThrow(BadRequestException);
  });

  it('should reject invitation', async () => {
    mockInvitationRepo.findById.mockResolvedValue(
      new Invitation('inv-1', 'ws-1', 'u-1', 'a@b.com', null, 'pending', new Date(), new Date()),
    );
    mockInvitationRepo.updateStatus.mockResolvedValue(undefined);

    const result = await useCase.execute('user-2', 'inv-1');
    expect(mockInvitationRepo.updateStatus).toHaveBeenCalledWith('inv-1', 'rejected', 'user-2');
    expect(result).toEqual({ status: 'rejected' });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { RejectInvitationUseCase } from './reject-invitation.use-case';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvitationOrmEntity } from '../../../infrastructure/database/entities/invitation.orm-entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('RejectInvitationUseCase', () => {
  let useCase: RejectInvitationUseCase;

  const mockInvitationRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RejectInvitationUseCase,
        {
          provide: getRepositoryToken(InvitationOrmEntity),
          useValue: mockInvitationRepo,
        },
      ],
    }).compile();

    useCase = module.get<RejectInvitationUseCase>(RejectInvitationUseCase);
  });

  it('should throw NotFoundException if invitation not found', async () => {
    mockInvitationRepo.findOne.mockResolvedValue(null);
    await expect(useCase.execute('user-2', 'inv-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException if not pending', async () => {
    mockInvitationRepo.findOne.mockResolvedValue({ status: 'accepted' });
    await expect(useCase.execute('user-2', 'inv-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject invitation', async () => {
    const invitation = {
      id: 'inv-1',
      status: 'pending',
      invitee_user_id: null,
    };
    mockInvitationRepo.findOne.mockResolvedValue(invitation);

    const result = await useCase.execute('user-2', 'inv-1');

    expect(invitation.status).toBe('rejected');
    expect(invitation.invitee_user_id).toBe('user-2');
    expect(mockInvitationRepo.save).toHaveBeenCalledWith(invitation);
    expect(result).toEqual({ status: 'rejected' });
  });
});

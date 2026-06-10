import { Test, TestingModule } from '@nestjs/testing';
import { AcceptInvitationUseCase } from './accept-invitation.use-case';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvitationOrmEntity } from '../../../infrastructure/database/entities/invitation.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AcceptInvitationUseCase', () => {
  let useCase: AcceptInvitationUseCase;

  let savedInvitation: Record<string, unknown>;
  let savedMember: Record<string, unknown>;

  const mockManager = {
    findOne: jest.fn(),
    create: jest
      .fn()
      .mockImplementation((_entity: unknown, dto: unknown) => dto),
    save: jest.fn().mockImplementation((entity: unknown) => {
      const e = entity as Record<string, unknown>;
      if (e.role) savedMember = e;
      else savedInvitation = e;
      return Promise.resolve(e);
    }),
  };

  const mockInvitationRepo = {
    manager: {
      transaction: jest
        .fn()
        .mockImplementation(
          (cb: (manager: typeof mockManager) => Promise<unknown>) =>
            cb(mockManager),
        ),
    },
  };

  const mockMemberRepo = {};

  beforeEach(async () => {
    jest.clearAllMocks();
    savedInvitation = {};
    savedMember = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcceptInvitationUseCase,
        {
          provide: getRepositoryToken(InvitationOrmEntity),
          useValue: mockInvitationRepo,
        },
        {
          provide: getRepositoryToken(WorkspaceMemberOrmEntity),
          useValue: mockMemberRepo,
        },
      ],
    }).compile();

    useCase = module.get<AcceptInvitationUseCase>(AcceptInvitationUseCase);
  });

  it('should throw NotFoundException if invitation not found', async () => {
    mockManager.findOne.mockResolvedValue(null);
    await expect(useCase.execute('user-2', 'inv-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException if not pending', async () => {
    mockManager.findOne.mockResolvedValue({ status: 'accepted' });
    await expect(useCase.execute('user-2', 'inv-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException if expired', async () => {
    mockManager.findOne.mockResolvedValue({
      status: 'pending',
      expires_at: new Date(Date.now() - 10000),
    });
    await expect(useCase.execute('user-2', 'inv-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should accept invitation and create member within transaction', async () => {
    mockManager.findOne.mockResolvedValue({
      id: 'inv-1',
      workspace_id: 'ws-1',
      status: 'pending',
      expires_at: new Date(Date.now() + 10000),
    });

    const result = await useCase.execute('user-2', 'inv-1');

    expect(mockManager.save).toHaveBeenCalledTimes(2);
    expect(savedInvitation.status).toBe('accepted');
    expect(savedInvitation.invitee_user_id).toBe('user-2');
    expect(savedMember.workspace_id).toBe('ws-1');
    expect(savedMember.user_id).toBe('user-2');
    expect(result).toEqual({ status: 'accepted', workspace_id: 'ws-1' });
  });
});

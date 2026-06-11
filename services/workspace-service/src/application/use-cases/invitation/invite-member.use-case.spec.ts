import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { InviteMemberUseCase } from './invite-member.use-case';
import { InvitationOrmEntity } from '../../../infrastructure/database/entities/invitation.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceOutboxService } from '../../../infrastructure/outbox/workspace-outbox.service';
import { ForbiddenException } from '@nestjs/common';

describe('InviteMemberUseCase', () => {
  let useCase: InviteMemberUseCase;

  const mockInvitationRepo = {
    create: jest.fn().mockImplementation((dto: unknown) => dto),
    save: jest.fn(),
  };

  const mockMemberRepo = {
    findOne: jest.fn(),
  };

  const mockWorkspaceRepo = {
    findOne: jest.fn(),
  };

  const mockOutboxService = {
    enqueueWorkspaceInvited: jest.fn(),
  };

  const mockManager = {
    create: jest.fn().mockImplementation((_entity, dto: unknown) => dto),
    save: jest
      .fn()
      .mockImplementation((entity: { workspace_id?: string; inviter_id?: string; invitee_email?: string }) =>
        Promise.resolve({
          id: 'inv-1',
          workspace_id: entity.workspace_id ?? 'ws-1',
          inviter_id: entity.inviter_id ?? 'user-1',
          invitee_email: entity.invitee_email ?? 'test@example.com',
        }),
      ),
  };

  const mockDataSource = {
    transaction: jest.fn((operation: (manager: typeof mockManager) => Promise<unknown>) =>
      operation(mockManager),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteMemberUseCase,
        {
          provide: getRepositoryToken(InvitationOrmEntity),
          useValue: mockInvitationRepo,
        },
        {
          provide: getRepositoryToken(WorkspaceMemberOrmEntity),
          useValue: mockMemberRepo,
        },
        {
          provide: getRepositoryToken(WorkspaceOrmEntity),
          useValue: mockWorkspaceRepo,
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
        {
          provide: WorkspaceOutboxService,
          useValue: mockOutboxService,
        },
      ],
    }).compile();

    useCase = module.get<InviteMemberUseCase>(InviteMemberUseCase);
  });

  it('should throw ForbiddenException if user is not owner or admin', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'member' });
    await expect(
      useCase.execute('user-1', 'ws-1', { email: 'test@example.com' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should create invitation and enqueue outbox event if allowed', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'admin' });
    mockWorkspaceRepo.findOne.mockResolvedValue({
      id: 'ws-1',
      name: 'Test WS',
    });

    const result = await useCase.execute('user-1', 'ws-1', {
      email: 'test@example.com',
    });

    expect(mockDataSource.transaction).toHaveBeenCalled();
    expect(mockOutboxService.enqueueWorkspaceInvited).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        inviteEmail: 'test@example.com',
        eventId: expect.any(String),
        occurredAt: expect.any(String),
      }),
      mockManager,
    );
    expect(result.id).toBe('inv-1');
  });
});

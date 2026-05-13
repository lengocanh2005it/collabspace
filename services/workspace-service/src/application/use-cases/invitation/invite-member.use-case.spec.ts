import { Test, TestingModule } from '@nestjs/testing';
import { InviteMemberUseCase } from './invite-member.use-case';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvitationOrmEntity } from '../../../infrastructure/database/entities/invitation.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';
import { ForbiddenException } from '@nestjs/common';

describe('InviteMemberUseCase', () => {
  let useCase: InviteMemberUseCase;

  const mockInvitationRepo = {
    create: jest.fn().mockImplementation((dto: unknown) => dto),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) =>
        Promise.resolve({ id: 'inv-1', ...(entity as object) }),
      ),
  };

  const mockMemberRepo = {
    findOne: jest.fn(),
  };

  const mockWorkspaceRepo = {
    findOne: jest.fn(),
  };

  const mockRabbitChannel = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
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
          provide: 'RABBITMQ_CHANNEL',
          useValue: mockRabbitChannel,
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

  it('should create invitation and publish event if allowed', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'admin' });
    mockWorkspaceRepo.findOne.mockResolvedValue({
      id: 'ws-1',
      name: 'Test WS',
    });

    const result = await useCase.execute('user-1', 'ws-1', {
      email: 'test@example.com',
    });

    expect(mockInvitationRepo.create).toHaveBeenCalled();
    expect(mockInvitationRepo.save).toHaveBeenCalled();
    expect(mockRabbitChannel.publish).toHaveBeenCalledWith(
      'collabspace_exchange',
      'workspace.invited',
      expect.any(Buffer),
    );
    expect(result.id).toBe('inv-1');
  });
});

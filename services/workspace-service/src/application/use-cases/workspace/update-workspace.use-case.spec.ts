import { Test, TestingModule } from '@nestjs/testing';
import { UpdateWorkspaceUseCase } from './update-workspace.use-case';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('UpdateWorkspaceUseCase', () => {
  let useCase: UpdateWorkspaceUseCase;

  const mockWorkspaceRepo = {
    findOne: jest.fn(),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) => Promise.resolve(entity)),
  };

  const mockMemberRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateWorkspaceUseCase,
        {
          provide: getRepositoryToken(WorkspaceOrmEntity),
          useValue: mockWorkspaceRepo,
        },
        {
          provide: getRepositoryToken(WorkspaceMemberOrmEntity),
          useValue: mockMemberRepo,
        },
      ],
    }).compile();

    useCase = module.get<UpdateWorkspaceUseCase>(UpdateWorkspaceUseCase);
  });

  it('should throw ForbiddenException if user is not owner or admin', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'member' });
    await expect(
      useCase.execute('user-1', 'workspace-1', { name: 'New Name' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw NotFoundException if workspace does not exist', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'admin' });
    mockWorkspaceRepo.findOne.mockResolvedValue(null);
    await expect(
      useCase.execute('user-1', 'workspace-1', { name: 'New Name' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should update and save workspace if allowed', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'owner' });
    mockWorkspaceRepo.findOne.mockResolvedValue({ id: 'ws-1', name: 'Old' });
    const result = await useCase.execute('user-1', 'ws-1', {
      name: 'New Name',
    });
    expect(result).toEqual({ id: 'ws-1', name: 'New Name' });
    expect(mockWorkspaceRepo.save).toHaveBeenCalled();
  });
});

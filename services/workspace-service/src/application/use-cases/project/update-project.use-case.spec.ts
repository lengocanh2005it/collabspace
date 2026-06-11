import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UpdateProjectUseCase } from './update-project.use-case';
import { PROJECT_REPOSITORY } from '../../../domain/repositories/project.repository';
import { WORKSPACE_MEMBER_REPOSITORY } from '../../../domain/repositories/workspace-member.repository';
import { Project } from '../../../domain/entities/project.entity';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';

describe('UpdateProjectUseCase', () => {
  let useCase: UpdateProjectUseCase;

  const mockProjectRepo = { findById: jest.fn(), update: jest.fn() };
  const mockMemberRepo = { findByWorkspaceAndUser: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateProjectUseCase,
        { provide: PROJECT_REPOSITORY, useValue: mockProjectRepo },
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: mockMemberRepo },
      ],
    }).compile();
    useCase = module.get<UpdateProjectUseCase>(UpdateProjectUseCase);
  });

  it('should throw ForbiddenException if user is not owner or admin', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'member', new Date()),
    );
    await expect(
      useCase.execute('user-1', 'ws-1', 'proj-1', { name: 'New' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw NotFoundException if project does not exist', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'admin', new Date()),
    );
    mockProjectRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute('user-1', 'ws-1', 'proj-1', { name: 'New' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should call update and return result if allowed', async () => {
    const updated = new Project(
      'proj-1',
      'ws-1',
      'New Name',
      null,
      'user-1',
      false,
      new Date(),
      new Date(),
    );
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'owner', new Date()),
    );
    mockProjectRepo.findById.mockResolvedValue(
      new Project(
        'proj-1',
        'ws-1',
        'Old',
        null,
        'user-1',
        false,
        new Date(),
        new Date(),
      ),
    );
    mockProjectRepo.update.mockResolvedValue(updated);

    const result = await useCase.execute('user-1', 'ws-1', 'proj-1', {
      name: 'New Name',
    });
    expect(mockProjectRepo.update).toHaveBeenCalledWith('proj-1', 'ws-1', {
      name: 'New Name',
      description: undefined,
    });
    expect(result).toBe(updated);
  });
});

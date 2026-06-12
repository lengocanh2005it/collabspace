import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeleteProjectUseCase } from './delete-project.use-case';
import { PROJECT_REPOSITORY } from '../../../domain/repositories/project.repository';
import { WORKSPACE_MEMBER_REPOSITORY } from '../../../domain/repositories/workspace-member.repository';
import { WORKSPACE_ACTIVITY_REPOSITORY } from '../../../domain/repositories/workspace-activity.repository';
import { Project } from '../../../domain/entities/project.entity';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';

describe('DeleteProjectUseCase', () => {
  let useCase: DeleteProjectUseCase;

  const mockProjectRepo = { findById: jest.fn(), softDelete: jest.fn() };
  const mockMemberRepo = { findByWorkspaceAndUser: jest.fn() };
  const mockActivityRepo = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteProjectUseCase,
        { provide: PROJECT_REPOSITORY, useValue: mockProjectRepo },
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: mockMemberRepo },
        { provide: WORKSPACE_ACTIVITY_REPOSITORY, useValue: mockActivityRepo },
      ],
    }).compile();
    useCase = module.get<DeleteProjectUseCase>(DeleteProjectUseCase);
  });

  it('should throw ForbiddenException if user is not owner or admin', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'member', new Date()),
    );
    await expect(useCase.execute('user-1', 'ws-1', 'proj-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw NotFoundException if project does not exist', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'admin', new Date()),
    );
    mockProjectRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('user-1', 'ws-1', 'proj-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should soft delete project if allowed', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'owner', new Date()),
    );
    mockProjectRepo.findById.mockResolvedValue(
      new Project(
        'proj-1',
        'ws-1',
        'P',
        null,
        'user-1',
        false,
        new Date(),
        new Date(),
      ),
    );
    mockProjectRepo.softDelete.mockResolvedValue(undefined);

    const result = await useCase.execute('user-1', 'ws-1', 'proj-1');
    expect(mockProjectRepo.softDelete).toHaveBeenCalledWith('proj-1', 'ws-1');
    expect(result).toEqual({ status: 'deleted' });
  });
});

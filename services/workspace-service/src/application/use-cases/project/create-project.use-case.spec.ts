import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CreateProjectUseCase } from './create-project.use-case';
import { PROJECT_REPOSITORY } from '../../../domain/repositories/project.repository';
import { WORKSPACE_MEMBER_REPOSITORY } from '../../../domain/repositories/workspace-member.repository';
import { WORKSPACE_ACTIVITY_REPOSITORY } from '../../../domain/repositories/workspace-activity.repository';
import { Project } from '../../../domain/entities/project.entity';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';

describe('CreateProjectUseCase', () => {
  let useCase: CreateProjectUseCase;

  const mockProjectRepo = { create: jest.fn() };
  const mockMemberRepo = { findByWorkspaceAndUser: jest.fn() };
  const mockActivityRepo = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateProjectUseCase,
        { provide: PROJECT_REPOSITORY, useValue: mockProjectRepo },
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: mockMemberRepo },
        { provide: WORKSPACE_ACTIVITY_REPOSITORY, useValue: mockActivityRepo },
      ],
    }).compile();
    useCase = module.get<CreateProjectUseCase>(CreateProjectUseCase);
  });

  it('should throw ForbiddenException if user is not a member', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(null);
    await expect(useCase.execute('user-1', 'ws-1', { name: 'Proj' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should create project if user is a member', async () => {
    const project = new Project(
      'proj-1',
      'ws-1',
      'Proj',
      null,
      'user-1',
      false,
      new Date(),
      new Date(),
    );
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'member', new Date()),
    );
    mockProjectRepo.create.mockResolvedValue(project);

    const result = await useCase.execute('user-1', 'ws-1', { name: 'Proj' });
    expect(mockProjectRepo.create).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      name: 'Proj',
      description: undefined,
      createdBy: 'user-1',
    });
    expect(result).toBe(project);
  });
});

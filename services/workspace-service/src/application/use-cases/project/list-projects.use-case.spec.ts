import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ListProjectsUseCase } from './list-projects.use-case';
import { PROJECT_REPOSITORY } from '../../../domain/repositories/project.repository';
import { WORKSPACE_MEMBER_REPOSITORY } from '../../../domain/repositories/workspace-member.repository';
import { Project } from '../../../domain/entities/project.entity';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';

describe('ListProjectsUseCase', () => {
  let useCase: ListProjectsUseCase;

  const mockProjectRepo = { findByWorkspace: jest.fn() };
  const mockMemberRepo = { findByWorkspaceAndUser: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListProjectsUseCase,
        { provide: PROJECT_REPOSITORY, useValue: mockProjectRepo },
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: mockMemberRepo },
      ],
    }).compile();
    useCase = module.get<ListProjectsUseCase>(ListProjectsUseCase);
  });

  it('should throw ForbiddenException if user is not a member', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(null);
    await expect(useCase.execute('user-1', 'ws-1')).rejects.toThrow(ForbiddenException);
  });

  it('should return projects if user is a member', async () => {
    const projects = [
      new Project('proj-1', 'ws-1', 'P', null, 'user-1', false, new Date(), new Date()),
    ];
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'member', new Date()),
    );
    mockProjectRepo.findByWorkspace.mockResolvedValue(projects);
    const result = await useCase.execute('user-1', 'ws-1');
    expect(result).toBe(projects);
  });
});

import { Test, type TestingModule } from '@nestjs/testing';
import { ListWorkspacesUseCase } from './list-workspaces.use-case';
import { WORKSPACE_REPOSITORY } from '../../../domain/repositories/workspace.repository';
import { Workspace } from '../../../domain/entities/workspace.entity';

describe('ListWorkspacesUseCase', () => {
  let useCase: ListWorkspacesUseCase;

  const mockWorkspaceRepo = { findByMember: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListWorkspacesUseCase,
        { provide: WORKSPACE_REPOSITORY, useValue: mockWorkspaceRepo },
      ],
    }).compile();
    useCase = module.get<ListWorkspacesUseCase>(ListWorkspacesUseCase);
  });

  it('should list workspaces for user', async () => {
    const workspaces = [new Workspace('ws-1', 'Test', null, 'user-1', new Date(), new Date())];
    mockWorkspaceRepo.findByMember.mockResolvedValue(workspaces);
    const result = await useCase.execute('user-1');
    expect(mockWorkspaceRepo.findByMember).toHaveBeenCalledWith('user-1');
    expect(result).toBe(workspaces);
  });
});

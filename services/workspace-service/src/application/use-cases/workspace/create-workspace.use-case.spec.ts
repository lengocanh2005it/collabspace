import { Test, TestingModule } from '@nestjs/testing';
import { CreateWorkspaceUseCase } from './create-workspace.use-case';
import { WORKSPACE_REPOSITORY } from '../../../domain/repositories/workspace.repository';
import { Workspace } from '../../../domain/entities/workspace.entity';

describe('CreateWorkspaceUseCase', () => {
  let useCase: CreateWorkspaceUseCase;

  const mockWorkspaceRepo = {
    createWithOwner: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateWorkspaceUseCase,
        { provide: WORKSPACE_REPOSITORY, useValue: mockWorkspaceRepo },
      ],
    }).compile();

    useCase = module.get<CreateWorkspaceUseCase>(CreateWorkspaceUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should create a workspace with owner via repository', async () => {
    const expected = new Workspace(
      'uuid-1',
      'Test',
      null,
      'user-1',
      new Date(),
      new Date(),
    );
    mockWorkspaceRepo.createWithOwner.mockResolvedValue(expected);

    const result = await useCase.execute('user-1', { name: 'Test' });

    expect(mockWorkspaceRepo.createWithOwner).toHaveBeenCalledWith({
      name: 'Test',
      description: undefined,
      ownerId: 'user-1',
      userId: 'user-1',
    });
    expect(result).toBe(expected);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { CreateWorkspaceUseCase } from './create-workspace.use-case';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';

describe('CreateWorkspaceUseCase', () => {
  let useCase: CreateWorkspaceUseCase;

  let createdWorkspace: Record<string, unknown> | null = null;
  let createdMember: Record<string, unknown> | null = null;

  const mockManager = {
    create: jest
      .fn()
      .mockImplementation((_entity: unknown, dto: unknown) => dto),
    save: jest.fn().mockImplementation((entity: unknown) => {
      const obj = entity as Record<string, unknown>;
      if (obj.name) {
        createdWorkspace = { id: 'uuid-1234', ...obj };
        return Promise.resolve(createdWorkspace);
      }
      createdMember = { ...obj };
      return Promise.resolve(createdMember);
    }),
  };

  const mockWorkspaceRepo = {
    manager: {
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: typeof mockManager) => Promise<unknown>) =>
            cb(mockManager),
        ),
    },
  };

  const mockMemberRepo = {};

  beforeEach(async () => {
    jest.clearAllMocks();
    createdWorkspace = null;
    createdMember = null;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateWorkspaceUseCase,
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

    useCase = module.get<CreateWorkspaceUseCase>(CreateWorkspaceUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should create a workspace and add owner as member within a transaction', async () => {
    const userId = 'user-1';
    const dto = { name: 'Test Workspace' };

    const result = await useCase.execute(userId, dto);

    // Verify transaction was used
    expect(mockWorkspaceRepo.manager.transaction).toHaveBeenCalledTimes(1);

    // Verify workspace was created with correct fields
    expect(mockManager.create).toHaveBeenCalledTimes(2);
    expect(mockManager.save).toHaveBeenCalledTimes(2);

    // Verify the returned workspace
    expect(result).toBeDefined();
    expect((result as Record<string, unknown>).id).toBe('uuid-1234');
    expect((result as Record<string, unknown>).name).toBe('Test Workspace');
  });
});

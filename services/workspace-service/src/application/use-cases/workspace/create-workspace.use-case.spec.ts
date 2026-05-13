import { Test, TestingModule } from '@nestjs/testing';
import { CreateWorkspaceUseCase } from './create-workspace.use-case';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';

describe('CreateWorkspaceUseCase', () => {
  let useCase: CreateWorkspaceUseCase;

  const mockWorkspaceRepo = {
    create: jest.fn().mockImplementation((dto: unknown) => dto),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) =>
        Promise.resolve({ id: 'uuid', ...(entity as object) }),
      ),
  };

  const mockMemberRepo = {
    create: jest.fn().mockImplementation((dto: unknown) => dto),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) => Promise.resolve(entity)),
  };

  beforeEach(async () => {
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

  it('should create a workspace and owner member', async () => {
    const userId = 'user-1';
    const dto = { name: 'Test Workspace' };

    const result = await useCase.execute(userId, dto);

    expect(mockWorkspaceRepo.create).toHaveBeenCalledWith({
      name: 'Test Workspace',
      description: null,
      owner_id: userId,
    });
    expect(mockWorkspaceRepo.save).toHaveBeenCalled();
    expect(mockMemberRepo.create).toHaveBeenCalledWith({
      workspace_id: 'uuid',
      user_id: userId,
      role: 'owner',
    });
    expect(mockMemberRepo.save).toHaveBeenCalled();
    expect(result.id).toBe('uuid');
    expect(result.name).toBe('Test Workspace');
  });
});

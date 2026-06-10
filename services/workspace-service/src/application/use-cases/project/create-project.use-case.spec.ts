import { Test, TestingModule } from '@nestjs/testing';
import { CreateProjectUseCase } from './create-project.use-case';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectOrmEntity } from '../../../infrastructure/database/entities/project.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { ForbiddenException } from '@nestjs/common';

describe('CreateProjectUseCase', () => {
  let useCase: CreateProjectUseCase;

  const mockProjectRepo = {
    create: jest.fn().mockImplementation((dto: unknown) => dto),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) =>
        Promise.resolve({ id: 'proj-1', ...(entity as object) }),
      ),
  };

  const mockMemberRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateProjectUseCase,
        {
          provide: getRepositoryToken(ProjectOrmEntity),
          useValue: mockProjectRepo,
        },
        {
          provide: getRepositoryToken(WorkspaceMemberOrmEntity),
          useValue: mockMemberRepo,
        },
      ],
    }).compile();

    useCase = module.get<CreateProjectUseCase>(CreateProjectUseCase);
  });

  it('should throw ForbiddenException if user is not a member', async () => {
    mockMemberRepo.findOne.mockResolvedValue(null);
    await expect(
      useCase.execute('user-1', 'ws-1', { name: 'Proj' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should create and save project if user is a member', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'member' });
    const result = await useCase.execute('user-1', 'ws-1', { name: 'Proj' });
    expect(mockProjectRepo.create).toHaveBeenCalled();
    expect(mockProjectRepo.save).toHaveBeenCalled();
    expect(result.id).toBe('proj-1');
  });
});

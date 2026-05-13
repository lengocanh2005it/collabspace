import { Test, TestingModule } from '@nestjs/testing';
import { UpdateProjectUseCase } from './update-project.use-case';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectOrmEntity } from '../../../infrastructure/database/entities/project.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('UpdateProjectUseCase', () => {
  let useCase: UpdateProjectUseCase;

  const mockProjectRepo = {
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
        UpdateProjectUseCase,
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

    useCase = module.get<UpdateProjectUseCase>(UpdateProjectUseCase);
  });

  it('should throw ForbiddenException if user is not owner or admin', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'member' });
    await expect(
      useCase.execute('user-1', 'ws-1', 'proj-1', { name: 'New Name' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw NotFoundException if project does not exist or is deleted', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'admin' });
    mockProjectRepo.findOne.mockResolvedValue(null);
    await expect(
      useCase.execute('user-1', 'ws-1', 'proj-1', { name: 'New Name' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should update and save project if allowed', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'owner' });
    mockProjectRepo.findOne.mockResolvedValue({ id: 'proj-1', name: 'Old' });
    const result = await useCase.execute('user-1', 'ws-1', 'proj-1', {
      name: 'New Name',
    });
    expect(result.name).toBe('New Name');
    expect(mockProjectRepo.save).toHaveBeenCalled();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ListMembersUseCase } from './list-members.use-case';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { ForbiddenException } from '@nestjs/common';

describe('ListMembersUseCase', () => {
  let useCase: ListMembersUseCase;

  const mockMemberRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListMembersUseCase,
        {
          provide: getRepositoryToken(WorkspaceMemberOrmEntity),
          useValue: mockMemberRepo,
        },
      ],
    }).compile();

    useCase = module.get<ListMembersUseCase>(ListMembersUseCase);
  });

  it('should throw ForbiddenException if user is not a member', async () => {
    mockMemberRepo.findOne.mockResolvedValue(null);
    await expect(useCase.execute('user-1', 'workspace-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should return list of members if user is a member', async () => {
    mockMemberRepo.findOne.mockResolvedValue({ role: 'member' });
    mockMemberRepo.find.mockResolvedValue([
      { user_id: 'user-1' },
      { user_id: 'user-2' },
    ]);
    const result = await useCase.execute('user-1', 'workspace-1');
    expect(result).toEqual([{ user_id: 'user-1' }, { user_id: 'user-2' }]);
  });
});

import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ListMembersUseCase } from './list-members.use-case';
import { WORKSPACE_MEMBER_REPOSITORY } from '../../../domain/repositories/workspace-member.repository';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';

describe('ListMembersUseCase', () => {
  let useCase: ListMembersUseCase;

  const mockMemberRepo = {
    findByWorkspaceAndUser: jest.fn(),
    findByWorkspace: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListMembersUseCase,
        { provide: WORKSPACE_MEMBER_REPOSITORY, useValue: mockMemberRepo },
      ],
    }).compile();
    useCase = module.get<ListMembersUseCase>(ListMembersUseCase);
  });

  it('should throw ForbiddenException if user is not a member', async () => {
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(null);
    await expect(useCase.execute('user-1', 'ws-1')).rejects.toThrow(ForbiddenException);
  });

  it('should return list of members if user is a member', async () => {
    const members = [
      new WorkspaceMember('m-1', 'ws-1', 'user-1', 'member', new Date()),
      new WorkspaceMember('m-2', 'ws-1', 'user-2', 'member', new Date()),
    ];
    mockMemberRepo.findByWorkspaceAndUser.mockResolvedValue(members[0]);
    mockMemberRepo.findByWorkspace.mockResolvedValue(members);
    const result = await useCase.execute('user-1', 'ws-1');
    expect(result).toBe(members);
  });
});

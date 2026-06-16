import { ForbiddenException } from '@nestjs/common';
import { RemoveMemberUseCase } from './remove-member.use-case';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';
import { WorkspaceCacheService } from '../../../infrastructure/cache/workspace-cache.service';

describe('RemoveMemberUseCase', () => {
  const memberRepo = {
    findByWorkspaceAndUser: jest.fn(),
    removeByWorkspaceAndUser: jest.fn().mockResolvedValue(undefined),
  };
  const activityRepo = { record: jest.fn().mockResolvedValue(undefined) };
  const workspaceCache = { deleteWorkspaceList: jest.fn().mockResolvedValue(undefined) };
  const useCase = new RemoveMemberUseCase(
    memberRepo as never,
    activityRepo as never,
    workspaceCache as unknown as WorkspaceCacheService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('allows a member to leave the workspace', async () => {
    memberRepo.findByWorkspaceAndUser
      .mockResolvedValueOnce(new WorkspaceMember('m-1', 'ws-1', 'user-1', 'member', new Date()))
      .mockResolvedValueOnce(new WorkspaceMember('m-1', 'ws-1', 'user-1', 'member', new Date()));

    await useCase.execute('user-1', 'ws-1', 'user-1');
    expect(memberRepo.removeByWorkspaceAndUser).toHaveBeenCalledWith('ws-1', 'user-1');
  });

  it('blocks removing the workspace owner', async () => {
    memberRepo.findByWorkspaceAndUser
      .mockResolvedValueOnce(new WorkspaceMember('m-1', 'ws-1', 'owner-1', 'owner', new Date()))
      .mockResolvedValueOnce(new WorkspaceMember('m-1', 'ws-1', 'owner-1', 'owner', new Date()));

    await expect(useCase.execute('owner-1', 'ws-1', 'owner-1')).rejects.toThrow(ForbiddenException);
  });
});

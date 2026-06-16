import { ForbiddenException } from '@nestjs/common';
import { UpdateMemberRoleUseCase } from './update-member-role.use-case';
import { WorkspaceMember } from '../../../domain/entities/workspace-member.entity';
import { WorkspaceCacheService } from '../../../infrastructure/cache/workspace-cache.service';

describe('UpdateMemberRoleUseCase', () => {
  const memberRepo = {
    findByWorkspaceAndUser: jest.fn(),
    updateRole: jest.fn(),
  };
  const activityRepo = { record: jest.fn().mockResolvedValue(undefined) };
  const workspaceCache = { deleteWorkspaceList: jest.fn().mockResolvedValue(undefined) };
  const useCase = new UpdateMemberRoleUseCase(
    memberRepo as never,
    activityRepo as never,
    workspaceCache as unknown as WorkspaceCacheService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('allows owner to promote a member to admin', async () => {
    memberRepo.findByWorkspaceAndUser
      .mockResolvedValueOnce(new WorkspaceMember('m-1', 'ws-1', 'owner-1', 'owner', new Date()))
      .mockResolvedValueOnce(new WorkspaceMember('m-2', 'ws-1', 'user-2', 'member', new Date()));
    memberRepo.updateRole.mockResolvedValue(
      new WorkspaceMember('m-2', 'ws-1', 'user-2', 'admin', new Date()),
    );

    await expect(
      useCase.execute('owner-1', 'ws-1', 'user-2', { role: 'admin' }),
    ).resolves.toMatchObject({ role: 'admin' });
    expect(memberRepo.updateRole).toHaveBeenCalledWith('ws-1', 'user-2', 'admin');
  });

  it('blocks admin from promoting a member to admin', async () => {
    memberRepo.findByWorkspaceAndUser
      .mockResolvedValueOnce(new WorkspaceMember('m-1', 'ws-1', 'admin-1', 'admin', new Date()))
      .mockResolvedValueOnce(new WorkspaceMember('m-2', 'ws-1', 'user-2', 'member', new Date()));

    await expect(useCase.execute('admin-1', 'ws-1', 'user-2', { role: 'admin' })).rejects.toThrow(
      ForbiddenException,
    );
  });
});

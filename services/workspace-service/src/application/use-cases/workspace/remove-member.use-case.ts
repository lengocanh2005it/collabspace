import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type IWorkspaceMemberRepository,
  WORKSPACE_MEMBER_REPOSITORY,
} from '../../../domain/repositories/workspace-member.repository';
import {
  type IWorkspaceActivityRepository,
  WORKSPACE_ACTIVITY_REPOSITORY,
} from '../../../domain/repositories/workspace-activity.repository';
import { WorkspaceCacheService } from '../../../infrastructure/cache/workspace-cache.service';

@Injectable()
export class RemoveMemberUseCase {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
    @Inject(WORKSPACE_ACTIVITY_REPOSITORY)
    private readonly activityRepo: IWorkspaceActivityRepository,
    private readonly workspaceCache: WorkspaceCacheService,
  ) {}

  async execute(actorId: string, workspaceId: string, targetUserId: string): Promise<void> {
    const actor = await this.memberRepo.findByWorkspaceAndUser(workspaceId, actorId);
    if (!actor) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const target = await this.memberRepo.findByWorkspaceAndUser(workspaceId, targetUserId);
    if (!target) {
      throw new NotFoundException('Workspace member not found');
    }

    const isSelf = actorId === targetUserId;

    if (target.role === 'owner') {
      throw new ForbiddenException('The workspace owner cannot be removed');
    }

    if (isSelf) {
      await this.memberRepo.removeByWorkspaceAndUser(workspaceId, targetUserId);
      await this.recordRemoval(workspaceId, actorId, targetUserId, target.role, true);
      await this.workspaceCache.deleteWorkspaceList(targetUserId);
      return;
    }

    if (actor.role === 'member') {
      throw new ForbiddenException('Only owners or admins can remove members');
    }

    if (actor.role === 'admin' && target.role === 'admin') {
      throw new ForbiddenException('Admins cannot remove another admin');
    }

    await this.memberRepo.removeByWorkspaceAndUser(workspaceId, targetUserId);
    await this.recordRemoval(workspaceId, actorId, targetUserId, target.role, false);
    await this.workspaceCache.deleteWorkspaceList(targetUserId);
  }

  private async recordRemoval(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    previousRole: string,
    selfRemoved: boolean,
  ) {
    await this.activityRepo.record({
      workspaceId,
      actorId,
      actorName: null,
      type: 'member_removed',
      summary: selfRemoved ? 'Member left the workspace' : 'Member removed from workspace',
      meta: { targetUserId, previousRole, selfRemoved },
    });
  }
}

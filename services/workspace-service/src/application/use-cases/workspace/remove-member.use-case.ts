import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type IWorkspaceMemberRepository,
  WORKSPACE_MEMBER_REPOSITORY,
} from '../../../domain/repositories/workspace-member.repository';
import {
  type IWorkspaceActivityRepository,
  WORKSPACE_ACTIVITY_REPOSITORY,
} from '../../../domain/repositories/workspace-activity.repository';
import { WorkspaceCacheService } from '../../../infrastructure/cache/workspace-cache.service';
import { WorkspaceOutboxService } from '../../../infrastructure/outbox/workspace-outbox.service';

@Injectable()
export class RemoveMemberUseCase {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
    @Inject(WORKSPACE_ACTIVITY_REPOSITORY)
    private readonly activityRepo: IWorkspaceActivityRepository,
    private readonly workspaceCache: WorkspaceCacheService,
    private readonly workspaceOutbox: WorkspaceOutboxService,
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
      await this.removeAndRecord(workspaceId, actorId, targetUserId, target.role, true);
      return;
    }

    if (actor.role === 'owner') {
      await this.removeAndRecord(workspaceId, actorId, targetUserId, target.role, false);
      return;
    }

    if (actor.role === 'manager') {
      if (target.role !== 'member') {
        throw new ForbiddenException('Workspace managers can remove only members');
      }

      await this.removeAndRecord(workspaceId, actorId, targetUserId, target.role, false);
      return;
    }

    throw new ForbiddenException('Only the workspace owner or manager can remove members');
  }

  private async removeAndRecord(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    previousRole: string,
    selfRemoved: boolean,
  ): Promise<void> {
    await this.memberRepo.removeByWorkspaceAndUser(workspaceId, targetUserId);
    await this.recordRemoval(workspaceId, actorId, targetUserId, previousRole, selfRemoved);
    await this.workspaceOutbox.enqueueMemberLeft({
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      role: previousRole,
      userId: targetUserId,
      workspaceId,
    });
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

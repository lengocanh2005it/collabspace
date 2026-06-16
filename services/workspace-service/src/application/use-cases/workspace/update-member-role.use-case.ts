import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateMemberRoleDto } from '../../dto/update-member-role.dto';
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
export class UpdateMemberRoleUseCase {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
    @Inject(WORKSPACE_ACTIVITY_REPOSITORY)
    private readonly activityRepo: IWorkspaceActivityRepository,
    private readonly workspaceCache: WorkspaceCacheService,
  ) {}

  async execute(
    actorId: string,
    workspaceId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const actor = await this.memberRepo.findByWorkspaceAndUser(workspaceId, actorId);
    if (!actor) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const target = await this.memberRepo.findByWorkspaceAndUser(workspaceId, targetUserId);
    if (!target) {
      throw new NotFoundException('Workspace member not found');
    }

    if (target.role === 'owner') {
      throw new ForbiddenException('The workspace owner role cannot be changed');
    }

    if (actor.role === 'member') {
      throw new ForbiddenException('Only owners or admins can change member roles');
    }

    if (actor.role === 'admin') {
      if (target.role === 'admin') {
        throw new ForbiddenException('Admins cannot change another admin role');
      }
      if (dto.role === 'admin') {
        throw new ForbiddenException('Only the workspace owner can promote members to admin');
      }
    }

    if (target.role === dto.role) {
      return target;
    }

    const updated = await this.memberRepo.updateRole(workspaceId, targetUserId, dto.role);

    await this.activityRepo.record({
      workspaceId,
      actorId,
      actorName: null,
      type: 'member_role_changed',
      summary: `Member role changed to ${dto.role}`,
      meta: { targetUserId, previousRole: target.role, role: dto.role },
    });

    await this.workspaceCache.deleteWorkspaceList(targetUserId);

    return updated;
  }
}

import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateMemberRoleDto } from '../../dto/update-member-role.dto';
import {
  type IWorkspaceActivityRepository,
  WORKSPACE_ACTIVITY_REPOSITORY,
} from '../../../domain/repositories/workspace-activity.repository';
import {
  type IWorkspaceMemberRepository,
  WORKSPACE_MEMBER_REPOSITORY,
} from '../../../domain/repositories/workspace-member.repository';

@Injectable()
export class UpdateMemberRoleUseCase {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
    @Inject(WORKSPACE_ACTIVITY_REPOSITORY)
    private readonly activityRepo: IWorkspaceActivityRepository,
  ) {}

  async execute(
    actorId: string,
    workspaceId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<void> {
    const actor = await this.memberRepo.findByWorkspaceAndUser(workspaceId, actorId);
    if (actor?.role !== 'owner') {
      throw new ForbiddenException('Only the workspace owner can update member roles');
    }

    const target = await this.memberRepo.findByWorkspaceAndUser(workspaceId, targetUserId);
    if (!target) {
      throw new NotFoundException('Workspace member not found');
    }

    if (target.role === 'owner') {
      throw new ForbiddenException('The workspace owner role cannot be changed');
    }

    // Idempotent no-op.
    if (target.role === dto.role) {
      return;
    }

    await this.memberRepo.updateRoleByWorkspaceAndUser(workspaceId, targetUserId, dto.role);

    await this.activityRepo.record({
      workspaceId,
      actorId,
      actorName: null,
      type: 'member_role_changed',
      summary: `Member role changed to ${dto.role}`,
      meta: {
        targetUserId,
        previousRole: target.role,
        newRole: dto.role,
      },
    });
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { WorkspaceRole } from '@collabspace/shared';
import {
  type IWorkspaceRepository,
  WORKSPACE_REPOSITORY,
} from '../../../domain/repositories/workspace.repository';
import {
  type IWorkspaceMemberRepository,
  WORKSPACE_MEMBER_REPOSITORY,
} from '../../../domain/repositories/workspace-member.repository';

export type WorkspaceMembershipResult = {
  workspaceId: string;
  userId: string;
  isMember: boolean;
  role: WorkspaceRole | null;
};

@Injectable()
export class CheckWorkspaceMembershipUseCase {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepo: IWorkspaceRepository,
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
  ) {}

  async execute(workspaceId: string, userId: string): Promise<WorkspaceMembershipResult> {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const member = await this.memberRepo.findByWorkspaceAndUser(workspaceId, userId);

    return {
      workspaceId,
      userId,
      isMember: Boolean(member),
      role: member?.role ?? null,
    };
  }
}

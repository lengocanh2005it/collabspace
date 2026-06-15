import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  type IWorkspaceActivityRepository,
  WORKSPACE_ACTIVITY_REPOSITORY,
} from '../../../domain/repositories/workspace-activity.repository';
import {
  type IWorkspaceMemberRepository,
  WORKSPACE_MEMBER_REPOSITORY,
} from '../../../domain/repositories/workspace-member.repository';

@Injectable()
export class GetWorkspaceActivityUseCase {
  constructor(
    @Inject(WORKSPACE_ACTIVITY_REPOSITORY)
    private readonly activityRepo: IWorkspaceActivityRepository,
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
  ) {}

  async execute(
    userId: string,
    workspaceId: string,
    options?: { limit?: number; offset?: number },
  ) {
    const member = await this.memberRepo.findByWorkspaceAndUser(workspaceId, userId);
    if (!member) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    return this.activityRepo.findByWorkspace(workspaceId, options);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import {
  type IInvitationRepository,
  INVITATION_REPOSITORY,
} from '../../../domain/repositories/invitation.repository';
import {
  type IWorkspaceActivityRepository,
  WORKSPACE_ACTIVITY_REPOSITORY,
} from '../../../domain/repositories/workspace-activity.repository';

@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepo: IInvitationRepository,
    @Inject(WORKSPACE_ACTIVITY_REPOSITORY)
    private readonly activityRepo: IWorkspaceActivityRepository,
  ) {}

  async execute(userId: string, invitationId: string) {
    const result = await this.invitationRepo.acceptAndJoinWorkspace(
      invitationId,
      userId,
    );

    await this.activityRepo.record({
      workspaceId: result.workspaceId,
      actorId: userId,
      actorName: null,
      type: 'member_joined',
      summary: 'A new member joined the workspace',
      meta: { invitationId, userId },
    });

    return result;
  }
}

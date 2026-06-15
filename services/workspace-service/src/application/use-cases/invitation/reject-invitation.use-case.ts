import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type IInvitationRepository,
  INVITATION_REPOSITORY,
} from '../../../domain/repositories/invitation.repository';
import {
  type IWorkspaceActivityRepository,
  WORKSPACE_ACTIVITY_REPOSITORY,
} from '../../../domain/repositories/workspace-activity.repository';
import { InvitationInvalidStateError } from '../../../domain/exceptions/invitation.exceptions';

@Injectable()
export class RejectInvitationUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepo: IInvitationRepository,
    @Inject(WORKSPACE_ACTIVITY_REPOSITORY)
    private readonly activityRepo: IWorkspaceActivityRepository,
  ) {}

  async execute(userId: string, invitationId: string) {
    const invitation = await this.invitationRepo.findById(invitationId);
    if (!invitation) throw new NotFoundException('Invitation not found');

    try {
      invitation.assertCanReject();
    } catch (error) {
      if (error instanceof InvitationInvalidStateError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    await this.invitationRepo.updateStatus(invitationId, 'rejected', userId);

    await this.activityRepo.record({
      workspaceId: invitation.workspaceId,
      actorId: userId,
      actorName: null,
      type: 'invitation_rejected',
      summary: 'An invitation was declined',
      meta: { invitationId },
    });

    return { status: 'rejected' };
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type IInvitationRepository,
  INVITATION_REPOSITORY,
} from '../../../domain/repositories/invitation.repository';
import {
  type IWorkspaceActivityRepository,
  WORKSPACE_ACTIVITY_REPOSITORY,
} from '../../../domain/repositories/workspace-activity.repository';
import { AuthHttpClient } from '../../../integrations/auth/auth-http.client';
import { assertInvitationRecipient } from './invitation-recipient.util';

@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepo: IInvitationRepository,
    @Inject(WORKSPACE_ACTIVITY_REPOSITORY)
    private readonly activityRepo: IWorkspaceActivityRepository,
    private readonly authHttpClient: AuthHttpClient,
  ) {}

  async execute(userId: string, invitationId: string, authorizationHeader?: string) {
    const invitation = await this.invitationRepo.findById(invitationId);
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const email = await this.authHttpClient.getCurrentUserEmail(authorizationHeader);
    assertInvitationRecipient(invitation, userId, email);

    const result = await this.invitationRepo.acceptAndJoinWorkspace(invitationId, userId);

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

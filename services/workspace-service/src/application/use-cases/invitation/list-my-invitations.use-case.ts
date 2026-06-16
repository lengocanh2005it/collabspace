import { Inject, Injectable } from '@nestjs/common';
import {
  type IInvitationRepository,
  INVITATION_REPOSITORY,
} from '../../../domain/repositories/invitation.repository';
import {
  type IWorkspaceRepository,
  WORKSPACE_REPOSITORY,
} from '../../../domain/repositories/workspace.repository';
import { AuthHttpClient } from '../../../integrations/auth/auth-http.client';

export type MyInvitationResponse = {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  inviterId: string;
  inviteeEmail: string;
  inviteeUserId: string | null;
  status: string;
  createdAt: Date;
  expiresAt: Date;
};

@Injectable()
export class ListMyInvitationsUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepo: IInvitationRepository,
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepo: IWorkspaceRepository,
    private readonly authHttpClient: AuthHttpClient,
  ) {}

  async execute(userId: string, authorizationHeader?: string): Promise<MyInvitationResponse[]> {
    const email = await this.authHttpClient.getCurrentUserEmail(authorizationHeader);
    const invitations = await this.invitationRepo.findPendingForInvitee(email, userId);

    return Promise.all(
      invitations.map(async (invitation) => {
        const workspace = await this.workspaceRepo.findById(invitation.workspaceId);
        return {
          id: invitation.id,
          workspaceId: invitation.workspaceId,
          workspaceName: workspace?.name ?? null,
          inviterId: invitation.inviterId,
          inviteeEmail: invitation.inviteeEmail,
          inviteeUserId: invitation.inviteeUserId,
          status: invitation.status,
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt,
        };
      }),
    );
  }
}

import { Inject, Injectable, ForbiddenException } from '@nestjs/common';
import {
  type IInvitationRepository,
  INVITATION_REPOSITORY,
} from '../../../domain/repositories/invitation.repository';
import {
  type IWorkspaceMemberRepository,
  WORKSPACE_MEMBER_REPOSITORY,
} from '../../../domain/repositories/workspace-member.repository';
import type { Invitation } from '../../../domain/entities/invitation.entity';

export interface ListInvitationResponse {
  id: string;
  workspaceId: string;
  inviterId: string;
  inviteeEmail: string;
  inviteeUserId: string | null;
  status: string;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class ListInvitationsUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepo: IInvitationRepository,
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
  ) {}

  async execute(
    userId: string,
    workspaceId: string,
  ): Promise<ListInvitationResponse[]> {
    const requestingMember = await this.memberRepo.findByWorkspaceAndUser(
      workspaceId,
      userId,
    );

    if (!requestingMember) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const invitations =
      await this.invitationRepo.findPendingByWorkspace(workspaceId);

    return invitations.map((invitation) => this.toResponse(invitation));
  }

  private toResponse(invitation: Invitation): ListInvitationResponse {
    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      inviterId: invitation.inviterId,
      inviteeEmail: invitation.inviteeEmail,
      inviteeUserId: invitation.inviteeUserId,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
    };
  }
}

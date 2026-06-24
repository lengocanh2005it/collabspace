import type { Invitation } from '../entities/invitation.entity';

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');

export type AcceptInvitationResult = {
  status: 'accepted';
  workspaceId: string;
  memberJoined: boolean;
};

export interface IInvitationRepository {
  findById(id: string): Promise<Invitation | null>;
  findPendingByWorkspace(workspaceId: string): Promise<Invitation[]>;
  findPendingByWorkspaceAndEmail(workspaceId: string, email: string): Promise<Invitation | null>;
  createAndPublishInvited(data: {
    workspaceId: string;
    inviterId: string;
    inviteeEmail: string;
    inviteeUserId?: string | null;
    workspaceName?: string;
  }): Promise<Invitation>;
  findPendingForInvitee(email: string, userId: string): Promise<Invitation[]>;
  acceptAndJoinWorkspace(invitationId: string, userId: string): Promise<AcceptInvitationResult>;
  updateStatus(id: string, status: string, userId?: string): Promise<Invitation>;
}

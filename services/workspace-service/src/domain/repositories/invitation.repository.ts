import type { Invitation } from '../entities/invitation.entity';

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');

export interface IInvitationRepository {
  findById(id: string): Promise<Invitation | null>;
  findPendingByWorkspace(workspaceId: string): Promise<Invitation[]>;
  findPendingByWorkspaceAndEmail(workspaceId: string, email: string): Promise<Invitation | null>;
  createAndPublishInvited(data: {
    workspaceId: string;
    inviterId: string;
    inviteeEmail: string;
    workspaceName?: string;
  }): Promise<Invitation>;
  findPendingForInvitee(email: string, userId: string): Promise<Invitation[]>;
  acceptAndJoinWorkspace(
    invitationId: string,
    userId: string,
  ): Promise<{ status: string; workspaceId: string }>;
  updateStatus(id: string, status: string, userId?: string): Promise<Invitation>;
}

import type { EventEnvelopeFields } from './envelope';

export const WORKSPACE_INVITED_EVENT = 'workspace_invited';
export const WORKSPACE_DELETED_EVENT = 'workspace_deleted';

export interface WorkspaceInvitedEventPayload extends EventEnvelopeFields {
  workspaceId: string;
  workspaceName?: string;
  invitationId?: string;
  recipientId?: string;
  invitedUserId?: string;
  invitedById: string;
  invitedByName?: string;
  invitedByAvatarUrl?: string;
  role?: string;
  inviteEmail?: string;
}

export interface WorkspaceDeletedEventPayload extends EventEnvelopeFields {
  deletedById: string;
  workspaceId: string;
}

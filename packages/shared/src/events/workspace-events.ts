import type { EventEnvelopeFields } from './envelope';

export const WORKSPACE_INVITED_EVENT = 'workspace_invited';

export interface WorkspaceInvitedEventPayload extends EventEnvelopeFields {
  workspaceId: string;
  workspaceName: string;
  invitedUserId: string;
  invitedById: string;
  invitedByName: string;
  invitedByAvatarUrl?: string;
  role?: string;
  inviteEmail?: string;
}

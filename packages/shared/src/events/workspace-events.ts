import type { EventEnvelopeFields } from './envelope';

export const WORKSPACE_INVITED_EVENT = 'workspace_invited';
export const WORKSPACE_DELETED_EVENT = 'workspace_deleted';
export const WORKSPACE_CREATED_EVENT = 'workspace_created';
export const WORKSPACE_PROJECT_CREATED_EVENT = 'project_created';
export const WORKSPACE_MEMBER_JOINED_EVENT = 'member_joined';
export const WORKSPACE_MEMBER_LEFT_EVENT = 'member_left';

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

export interface WorkspaceCreatedEventPayload extends EventEnvelopeFields {
  ownerId: string;
  workspaceId: string;
  workspaceName: string;
}

export interface WorkspaceProjectCreatedEventPayload extends EventEnvelopeFields {
  createdBy: string;
  projectId: string;
  projectName: string;
  workspaceId: string;
}

export interface WorkspaceMemberJoinedEventPayload extends EventEnvelopeFields {
  invitationId?: string;
  role: string;
  userId: string;
  workspaceId: string;
}

export interface WorkspaceMemberLeftEventPayload extends EventEnvelopeFields {
  role?: string;
  userId: string;
  workspaceId: string;
}

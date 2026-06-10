// src/domain/events/workspace-events.ts

/**
 * Workspace-related Event Payloads
 * Events triggered when workspace operations occur
 */

export const WORKSPACE_INVITED_EVENT = "workspace_invited";

export type EventEnvelopeFields = {
  eventId: string;
  occurredAt: string;
};

export interface WorkspaceInvitedEventPayload extends EventEnvelopeFields {
  workspaceId: string;
  workspaceName: string;
  invitedUserId: string;
  invitedById: string;
  invitedByName: string;
  invitedByAvatarUrl?: string;
  role?: string; // 'member', 'admin', etc.
  inviteEmail?: string;
}

export interface WorkspaceMemberJoinedEventPayload {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  joinedAt: Date;
}

export interface WorkspaceMemberLeftEventPayload {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userName: string;
  leftAt: Date;
}

export interface WorkspaceMemberRoleChangedEventPayload {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userName: string;
  oldRole: string;
  newRole: string;
  changedBy: string;
  changedByName: string;
}

export interface WorkspaceCreatedEventPayload {
  workspaceId: string;
  workspaceName: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
}

export interface WorkspaceUpdatedEventPayload {
  workspaceId: string;
  workspaceName: string;
  updatedBy: string;
  updatedByName: string;
  changes: {
    fieldName: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface WorkspaceDeletedEventPayload {
  workspaceId: string;
  workspaceName: string;
  deletedBy: string;
  deletedByName: string;
  deletedAt: Date;
}

export {
  WORKSPACE_INVITED_EVENT,
  type EventEnvelopeFields,
  type WorkspaceInvitedEventPayload,
} from "@collabspace/shared";

// Notification-service-specific workspace event types
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
  changes: { fieldName: string; oldValue: unknown; newValue: unknown }[];
}

export interface WorkspaceDeletedEventPayload {
  workspaceId: string;
  workspaceName: string;
  deletedBy: string;
  deletedByName: string;
  deletedAt: Date;
}

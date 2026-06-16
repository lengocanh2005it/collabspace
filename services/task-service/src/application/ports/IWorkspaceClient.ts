import type { WorkspaceRole } from "@collabspace/shared";

export const WORKSPACE_CLIENT_TOKEN = Symbol("WORKSPACE_CLIENT");

export type WorkspaceMember = {
  role: WorkspaceRole;
  userId: string;
};

/** Single membership fetch result; `null` when workspace does not exist (HTTP 404). */
export type WorkspaceMembershipSnapshot = {
  isMember: boolean;
  role: WorkspaceRole | null;
};

export interface IWorkspaceClient {
  /**
   * One internal membership call — prefer this in guards/hot paths.
   */
  getMembershipAsync(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipSnapshot | null>;

  validateWorkspaceAsync(workspaceId: string, userId: string): Promise<boolean>;

  checkUserPermissionAsync(
    workspaceId: string,
    userId: string,
    requiredRole?: WorkspaceRole,
  ): Promise<boolean>;

  getWorkspaceMemberAsync(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
}

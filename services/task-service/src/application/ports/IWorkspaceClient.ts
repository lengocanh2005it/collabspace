export const WORKSPACE_CLIENT_TOKEN = Symbol("WORKSPACE_CLIENT");

export type WorkspaceMember = {
  role: "owner" | "admin" | "member";
  userId: string;
};

export interface IWorkspaceClient {
  validateWorkspaceAsync(workspaceId: string, userId: string): Promise<boolean>;

  checkUserPermissionAsync(
    workspaceId: string,
    userId: string,
    requiredRole?: "owner" | "admin" | "member",
  ): Promise<boolean>;

  getWorkspaceMemberAsync(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null>;
}

import type { WorkspaceMember } from "../../application/ports/IWorkspaceClient";

const ROLE_HIERARCHY: Record<WorkspaceMember["role"], number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

export function meetsWorkspaceRole(
  role: WorkspaceMember["role"] | null,
  requiredRole: WorkspaceMember["role"] = "member",
): boolean {
  if (!role) {
    return false;
  }

  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole];
}

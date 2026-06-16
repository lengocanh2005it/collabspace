export const WORKSPACE_ROLES = ['owner', 'manager', 'member'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Roles an owner may assign via PATCH /workspaces/:id/members/:userId */
export const ASSIGNABLE_WORKSPACE_ROLES = ['manager', 'member'] as const;
export type AssignableWorkspaceRole = (typeof ASSIGNABLE_WORKSPACE_ROLES)[number];

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  owner: 3,
  manager: 2,
  member: 1,
};

export function meetsWorkspaceRole(
  role: WorkspaceRole | null | undefined,
  requiredRole: WorkspaceRole = 'member',
): boolean {
  if (!role) {
    return false;
  }

  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole];
}

/** Parse S2S/HTTP role strings; maps legacy workspace `admin` → `member`. */
export function parseWorkspaceRole(role: string | null | undefined): WorkspaceRole | null {
  if (!role) {
    return null;
  }

  if (role === 'owner' || role === 'manager' || role === 'member') {
    return role;
  }

  if (role === 'admin') {
    return 'member';
  }

  return null;
}

export function normalizeWorkspaceRole(role: string): WorkspaceRole {
  return parseWorkspaceRole(role) ?? 'member';
}

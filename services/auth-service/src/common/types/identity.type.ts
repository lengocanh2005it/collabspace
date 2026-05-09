export type AuthUser = {
  email: string;
  isActive: boolean;
  permissions: string[];
  role?: string;
  roles: string[];
  userId: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  roleNames?: string[];
  workspaceId?: string;
};

export type LoginInput = {
  email: string;
  password: string;
  workspaceId?: string;
};

export type CreateRoleInput = {
  description: string;
  name: string;
};

export type CreatePermissionInput = {
  description: string;
  name: string;
};

export type AssignUserRoleInput = {
  roleName: string;
};

export type AssignRolePermissionInput = {
  permissionName: string;
};

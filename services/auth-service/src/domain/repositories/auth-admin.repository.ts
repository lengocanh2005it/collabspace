export const AUTH_ADMIN_REPOSITORY = Symbol('AUTH_ADMIN_REPOSITORY');

export type AdminRole = {
  description: string;
  id: string;
  name: string;
  permissions: string[];
};

export type AdminPermission = {
  description: string;
  id: string;
  name: string;
};

export type AdminUser = {
  createdAt: Date;
  email: string;
  emailVerified: boolean;
  id: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  roles: string[];
};

export interface AuthAdminRepository {
  assignPermissionToRole(roleId: string, permissionId: string): Promise<AdminRole>;
  assignRoleToUser(userId: string, roleId: string): Promise<AdminUser>;
  createPermission(input: { description: string; name: string }): Promise<AdminPermission>;
  createRole(input: { description: string; name: string }): Promise<AdminRole>;
  deleteRole(roleId: string): Promise<void>;
  listPermissions(): Promise<AdminPermission[]>;
  listRoles(): Promise<AdminRole[]>;
  listUsers(): Promise<AdminUser[]>;
  recordLogin(userId: string): Promise<void>;
  setUserActive(userId: string, isActive: boolean): Promise<AdminUser>;
  updateRole(roleId: string, input: { description?: string; name?: string }): Promise<AdminRole>;
}

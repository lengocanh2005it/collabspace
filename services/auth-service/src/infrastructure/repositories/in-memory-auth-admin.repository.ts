import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type AdminPermission,
  type AdminRole,
  type AdminUser,
  type AuthAdminRepository,
} from '@/domain/repositories/auth-admin.repository';

@Injectable()
export class InMemoryAuthAdminRepository implements AuthAdminRepository {
  private readonly permissions: AdminPermission[] = [];
  private readonly roles: AdminRole[] = [];
  private readonly users: AdminUser[] = [];

  async createRole(input: {
    description: string;
    name: string;
  }): Promise<AdminRole> {
    const name = input.name.trim().toLowerCase();
    if (this.roles.some((role) => role.name === name)) {
      throw new ConflictException({
        code: 'ROLE_ALREADY_EXISTS',
        message: `Role ${name} already exists`,
      });
    }
    const role = {
      description: input.description.trim(),
      id: randomUUID(),
      name,
      permissions: [],
    };
    this.roles.push(role);
    return role;
  }

  async createPermission(input: {
    description: string;
    name: string;
  }): Promise<AdminPermission> {
    const name = input.name.trim().toLowerCase();
    if (this.permissions.some((permission) => permission.name === name)) {
      throw new ConflictException({
        code: 'PERMISSION_ALREADY_EXISTS',
        message: `Permission ${name} already exists`,
      });
    }
    const permission = {
      description: input.description.trim(),
      id: randomUUID(),
      name,
    };
    this.permissions.push(permission);
    return permission;
  }

  async assignPermissionToRole(
    roleId: string,
    permissionId: string,
  ): Promise<AdminRole> {
    const role = this.requireRole(roleId);
    const permission = this.permissions.find(
      (item) => item.id === permissionId,
    );
    if (!permission)
      throw new NotFoundException({
        code: 'PERMISSION_NOT_FOUND',
        message: `Permission ${permissionId} was not found`,
      });
    if (!role.permissions.includes(permission.name))
      role.permissions.push(permission.name);
    return role;
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<AdminUser> {
    const user = this.requireUser(userId);
    const role = this.requireRole(roleId);
    if (!user.roles.includes(role.name)) user.roles.push(role.name);
    return user;
  }

  async listRoles(): Promise<AdminRole[]> {
    return [...this.roles];
  }
  async listPermissions(): Promise<AdminPermission[]> {
    return [...this.permissions];
  }
  async listUsers(): Promise<AdminUser[]> {
    return [...this.users];
  }

  async setUserActive(userId: string, isActive: boolean): Promise<AdminUser> {
    const user = this.requireUser(userId);
    user.isActive = isActive;
    return user;
  }

  async updateRole(
    roleId: string,
    input: { description?: string; name?: string },
  ): Promise<AdminRole> {
    const role = this.requireRole(roleId);
    if (input.name !== undefined) role.name = input.name.trim().toLowerCase();
    if (input.description !== undefined)
      role.description = input.description.trim();
    return role;
  }

  async deleteRole(roleId: string): Promise<void> {
    const index = this.roles.findIndex((role) => role.id === roleId);
    if (index < 0)
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: `Role ${roleId} was not found`,
      });
    const role = this.roles[index];
    if (
      ['admin', 'member', 'viewer'].includes(role.name) ||
      this.users.some((user) => user.roles.includes(role.name))
    ) {
      throw new ConflictException({
        code: 'ROLE_IN_USE',
        message: `Role ${role.name} cannot be deleted while protected or assigned`,
      });
    }
    this.roles.splice(index, 1);
  }

  async recordLogin(userId: string): Promise<void> {
    const user = this.users.find((item) => item.id === userId);
    if (user) user.lastLoginAt = new Date();
  }

  private requireRole(id: string): AdminRole {
    const role = this.roles.find((item) => item.id === id);
    if (!role)
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: `Role ${id} was not found`,
      });
    return role;
  }

  private requireUser(id: string): AdminUser {
    const user = this.users.find((item) => item.id === id);
    if (!user)
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `User ${id} was not found`,
      });
    return user;
  }
}

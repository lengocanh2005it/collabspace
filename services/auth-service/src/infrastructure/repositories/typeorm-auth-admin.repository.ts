import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { Repository } from 'typeorm';
import type {
  AdminPermission,
  AdminRole,
  AdminUser,
  AuthAdminRepository,
} from '@/domain/repositories/auth-admin.repository';
import { PermissionOrmEntity } from '@/infrastructure/database/entities/permission.orm-entity';
import { RolePermissionOrmEntity } from '@/infrastructure/database/entities/role-permission.orm-entity';
import { RoleOrmEntity } from '@/infrastructure/database/entities/role.orm-entity';
import { UserRoleOrmEntity } from '@/infrastructure/database/entities/user-role.orm-entity';
import { UserOrmEntity } from '@/infrastructure/database/entities/user.orm-entity';

const PROTECTED_ROLES = new Set(['admin', 'member', 'viewer']);

@Injectable()
export class TypeOrmAuthAdminRepository implements AuthAdminRepository {
  constructor(
    @InjectRepository(PermissionOrmEntity)
    private readonly permissionRepository: Repository<PermissionOrmEntity>,
    @InjectRepository(RoleOrmEntity)
    private readonly roleRepository: Repository<RoleOrmEntity>,
    @InjectRepository(RolePermissionOrmEntity)
    private readonly rolePermissionRepository: Repository<RolePermissionOrmEntity>,
    @InjectRepository(UserOrmEntity)
    private readonly userRepository: Repository<UserOrmEntity>,
    @InjectRepository(UserRoleOrmEntity)
    private readonly userRoleRepository: Repository<UserRoleOrmEntity>,
  ) {}

  async createRole(input: { description: string; name: string }): Promise<AdminRole> {
    const name = this.normalizeName(input.name);
    await this.assertRoleNameAvailable(name);
    const role = await this.roleRepository.save(
      this.roleRepository.create({
        description: input.description.trim(),
        id: randomUUID(),
        name,
      }),
    );
    return this.toAdminRole(role);
  }

  async createPermission(input: { description: string; name: string }): Promise<AdminPermission> {
    const name = this.normalizeName(input.name);
    const existing = await this.permissionRepository.findOne({
      where: { name },
    });
    if (existing) {
      throw new ConflictException({
        code: 'PERMISSION_ALREADY_EXISTS',
        message: `Permission ${name} already exists`,
      });
    }
    const permission = await this.permissionRepository.save(
      this.permissionRepository.create({
        description: input.description.trim(),
        id: randomUUID(),
        name,
      }),
    );
    return this.toAdminPermission(permission);
  }

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<AdminRole> {
    const [, permission] = await Promise.all([
      this.loadRole(roleId),
      this.permissionRepository.findOne({ where: { id: permissionId } }),
    ]);
    if (!permission) {
      throw new NotFoundException({
        code: 'PERMISSION_NOT_FOUND',
        message: `Permission ${permissionId} was not found`,
      });
    }
    await this.rolePermissionRepository.upsert({ permissionId, roleId }, [
      'roleId',
      'permissionId',
    ]);
    return this.toAdminRole(await this.loadRole(roleId));
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<AdminRole> {
    await this.loadRole(roleId);
    const permission = await this.permissionRepository.findOne({ where: { id: permissionId } });
    if (!permission) {
      throw new NotFoundException({
        code: 'PERMISSION_NOT_FOUND',
        message: `Permission ${permissionId} was not found`,
      });
    }

    const result = await this.rolePermissionRepository.delete({ permissionId, roleId });
    if (!result.affected) {
      throw new NotFoundException({
        code: 'ROLE_PERMISSION_NOT_FOUND',
        message: `Permission ${permission.name} is not assigned to role ${roleId}`,
      });
    }

    return this.toAdminRole(await this.loadRole(roleId));
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<AdminUser> {
    await Promise.all([this.loadUser(userId), this.loadRole(roleId)]);
    await this.userRoleRepository.upsert({ roleId, userId }, ['userId', 'roleId']);
    return this.toAdminUser(await this.loadUser(userId));
  }

  async listRoles(): Promise<AdminRole[]> {
    const roles = await this.roleRepository.find({
      order: { name: 'ASC' },
      relations: { rolePermissions: { permission: true } },
    });
    return roles.map((role) => this.toAdminRole(role));
  }

  async listPermissions(): Promise<AdminPermission[]> {
    return (await this.permissionRepository.find({ order: { name: 'ASC' } })).map((permission) =>
      this.toAdminPermission(permission),
    );
  }

  async listUsers(): Promise<AdminUser[]> {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
      relations: { userRoles: { role: true } },
    });
    return users.map((user) => this.toAdminUser(user));
  }

  async setUserActive(userId: string, isActive: boolean): Promise<AdminUser> {
    const user = await this.loadUser(userId);
    user.isActive = isActive;
    await this.userRepository.save(user);
    return this.toAdminUser(await this.loadUser(userId));
  }

  async updateRole(
    roleId: string,
    input: { description?: string; name?: string },
  ): Promise<AdminRole> {
    const role = await this.loadRole(roleId);
    if (input.name !== undefined) {
      const name = this.normalizeName(input.name);
      if (name !== role.name) {
        await this.assertRoleNameAvailable(name);
      }
      role.name = name;
    }
    if (input.description !== undefined) {
      role.description = input.description.trim();
    }
    await this.roleRepository.save(role);
    return this.toAdminRole(await this.loadRole(roleId));
  }

  async deleteRole(roleId: string): Promise<void> {
    const role = await this.loadRole(roleId);
    const assignedUsers = await this.userRoleRepository.count({
      where: { roleId },
    });
    if (PROTECTED_ROLES.has(role.name) || assignedUsers > 0) {
      throw new ConflictException({
        code: 'ROLE_IN_USE',
        message: `Role ${role.name} cannot be deleted while protected or assigned`,
      });
    }
    await this.roleRepository.delete({ id: roleId });
  }

  async recordLogin(userId: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { lastLoginAt: new Date() });
  }

  private async assertRoleNameAvailable(name: string): Promise<void> {
    if (await this.roleRepository.findOne({ where: { name } })) {
      throw new ConflictException({
        code: 'ROLE_ALREADY_EXISTS',
        message: `Role ${name} already exists`,
      });
    }
  }

  private async loadRole(id: string): Promise<RoleOrmEntity> {
    const role = await this.roleRepository.findOne({
      relations: { rolePermissions: { permission: true } },
      where: { id },
    });
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: `Role ${id} was not found`,
      });
    }
    return role;
  }

  private async loadUser(id: string): Promise<UserOrmEntity> {
    const user = await this.userRepository.findOne({
      relations: { userRoles: { role: true } },
      where: { id },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `User ${id} was not found`,
      });
    }
    return user;
  }

  private normalizeName(value: string): string {
    return value.trim().toLowerCase();
  }

  private toAdminPermission(permission: PermissionOrmEntity): AdminPermission {
    return {
      description: permission.description,
      id: permission.id,
      name: permission.name,
    };
  }

  private toAdminRole(role: RoleOrmEntity): AdminRole {
    return {
      description: role.description,
      id: role.id,
      name: role.name,
      permissions: (role.rolePermissions ?? [])
        .map((item) => item.permission?.name)
        .filter((value): value is string => Boolean(value)),
    };
  }

  private toAdminUser(user: UserOrmEntity): AdminUser {
    return {
      createdAt: user.createdAt,
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      id: user.id,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      roles: (user.userRoles ?? [])
        .map((item) => item.role?.name)
        .filter((value): value is string => Boolean(value)),
    };
  }
}

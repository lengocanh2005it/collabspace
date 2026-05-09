import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { Repository } from 'typeorm';
import type {
  AssignRolePermissionInput,
  AssignUserRoleInput,
  AuthUser,
  CreatePermissionInput,
  CreateRoleInput,
  LoginInput,
  RegisterInput,
} from '@/common/types/identity.type';
import { PermissionEntity } from './entities/permission.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { RoleEntity } from './entities/role.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { UserEntity } from './entities/user.entity';

const scryptAsync = promisify(scrypt);

@Injectable()
export class IdentityService {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissionRepository: Repository<RolePermissionEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepository: Repository<UserRoleEntity>,
  ) {}

  async assignPermissionToRole(
    roleId: string,
    input: AssignRolePermissionInput,
  ): Promise<RoleEntity> {
    const permissionName = this.normalizeName(
      input.permissionName,
      'permission',
    );
    const role = await this.roleRepository.findOne({
      where: {
        id: roleId,
      },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: `Role ${roleId} was not found`,
      });
    }

    const permission = await this.permissionRepository.findOne({
      where: {
        name: permissionName,
      },
    });

    if (!permission) {
      throw new NotFoundException({
        code: 'PERMISSION_NOT_FOUND',
        message: `Permission ${permissionName} was not found`,
      });
    }

    const existingRolePermission = await this.rolePermissionRepository.findOne({
      where: {
        permissionId: permission.id,
        roleId: role.id,
      },
    });

    if (!existingRolePermission) {
      await this.rolePermissionRepository.save(
        this.rolePermissionRepository.create({
          permissionId: permission.id,
          roleId: role.id,
        }),
      );
    }

    return this.loadRoleById(role.id);
  }

  async assignRoleToUser(
    userId: string,
    input: AssignUserRoleInput,
  ): Promise<AuthUser> {
    const roleName = this.normalizeName(input.roleName, 'role');
    const role = await this.roleRepository.findOne({
      where: {
        name: roleName,
      },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: `Role ${roleName} was not found`,
      });
    }

    const user = await this.loadUserById(userId);

    const existingUserRole = await this.userRoleRepository.findOne({
      where: {
        roleId: role.id,
        userId: user.id,
      },
    });

    if (!existingUserRole) {
      await this.userRoleRepository.save(
        this.userRoleRepository.create({
          roleId: role.id,
          userId: user.id,
        }),
      );
    }

    return this.toAuthUser(await this.loadUserById(user.id));
  }

  async createPermission(
    input: CreatePermissionInput,
  ): Promise<PermissionEntity> {
    const name = this.normalizeName(input.name, 'permission');
    const description = this.normalizeDescription(
      input.description,
      'permission',
    );

    const existingPermission = await this.permissionRepository.findOne({
      where: {
        name,
      },
    });

    if (existingPermission) {
      throw new ConflictException({
        code: 'PERMISSION_ALREADY_EXISTS',
        message: `Permission ${name} already exists`,
      });
    }

    return this.permissionRepository.save(
      this.permissionRepository.create({
        description,
        id: randomUUID(),
        name,
      }),
    );
  }

  async createRole(input: CreateRoleInput): Promise<RoleEntity> {
    const name = this.normalizeName(input.name, 'role');
    const description = this.normalizeDescription(input.description, 'role');

    const existingRole = await this.roleRepository.findOne({
      where: {
        name,
      },
    });

    if (existingRole) {
      throw new ConflictException({
        code: 'ROLE_ALREADY_EXISTS',
        message: `Role ${name} already exists`,
      });
    }

    return this.roleRepository.save(
      this.roleRepository.create({
        description,
        id: randomUUID(),
        name,
      }),
    );
  }

  async getAuthUserById(userId: string): Promise<AuthUser> {
    return this.toAuthUser(await this.loadUserById(userId));
  }

  async markEmailVerified(userId: string): Promise<AuthUser> {
    const user = await this.loadUserById(userId);

    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      await this.userRepository.save(user);
    }

    return this.toAuthUser(user);
  }

  async register(input: RegisterInput): Promise<AuthUser> {
    const email = this.normalizeEmail(input.email);
    this.normalizeFullName(input.fullName);
    const password = this.normalizePassword(input.password);
    const existingUser = await this.userRepository.findOne({
      where: {
        email,
      },
      withDeleted: true,
    });

    if (existingUser) {
      throw new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message: `User ${email} already exists`,
      });
    }

    const user = await this.userRepository.save(
      this.userRepository.create({
        email,
        emailVerifiedAt: null,
        id: randomUUID(),
        isActive: true,
        passwordHash: await this.hashPassword(password),
      }),
    );

    const roleNames =
      input.roleNames && input.roleNames.length > 0
        ? input.roleNames
        : ['user'];

    for (const roleName of roleNames) {
      const role = await this.ensureRole(roleName);
      await this.userRoleRepository.save(
        this.userRoleRepository.create({
          roleId: role.id,
          userId: user.id,
        }),
      );
    }

    return this.getAuthUserById(user.id);
  }

  async validateCredentials(input: LoginInput): Promise<AuthUser> {
    const email = this.normalizeEmail(input.email);
    const password = this.normalizePassword(input.password);
    const user = await this.loadUserByEmail(email);

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'USER_INACTIVE',
        message: 'User account is inactive',
      });
    }

    const isPasswordValid = await this.verifyPassword(
      password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: 'LOGIN_INVALID',
        message: 'Email or password is invalid',
      });
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email address has not been verified',
      });
    }

    return this.toAuthUser(user);
  }

  private async ensureRole(roleName: string): Promise<RoleEntity> {
    const name = this.normalizeName(roleName, 'role');
    const existingRole = await this.roleRepository.findOne({
      where: {
        name,
      },
    });

    if (existingRole) {
      return existingRole;
    }

    return this.roleRepository.save(
      this.roleRepository.create({
        description: `${name} role`,
        id: randomUUID(),
        name,
      }),
    );
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `scrypt:${salt}:${derivedKey.toString('hex')}`;
  }

  private async loadRoleById(roleId: string): Promise<RoleEntity> {
    const role = await this.roleRepository.findOne({
      relations: {
        rolePermissions: {
          permission: true,
        },
      },
      where: {
        id: roleId,
      },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: `Role ${roleId} was not found`,
      });
    }

    return role;
  }

  private async loadUserByEmail(email: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      relations: {
        userRoles: {
          role: {
            rolePermissions: {
              permission: true,
            },
          },
        },
      },
      where: {
        email,
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException({
        code: 'LOGIN_INVALID',
        message: 'Email or password is invalid',
      });
    }

    return user;
  }

  private async loadUserById(userId: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      relations: {
        userRoles: {
          role: {
            rolePermissions: {
              permission: true,
            },
          },
        },
      },
      where: {
        id: userId,
      },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `User ${userId} was not found`,
      });
    }

    return user;
  }

  private normalizeDescription(value: string, fieldName: string): string {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      throw new BadRequestException({
        code: `${fieldName.toUpperCase()}_DESCRIPTION_REQUIRED`,
        message: `${fieldName} description is required`,
      });
    }

    return normalizedValue;
  }

  private normalizeEmail(email: string): string {
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new BadRequestException({
        code: 'EMAIL_INVALID',
        message: 'Email is invalid',
      });
    }

    return normalizedEmail;
  }

  private normalizeName(value: string, fieldName: string): string {
    const normalizedValue = value?.trim().toLowerCase();

    if (!normalizedValue) {
      throw new BadRequestException({
        code: `${fieldName.toUpperCase()}_NAME_REQUIRED`,
        message: `${fieldName} name is required`,
      });
    }

    return normalizedValue;
  }

  private normalizeFullName(fullName: string): string {
    const normalizedFullName = fullName?.trim();

    if (!normalizedFullName) {
      throw new BadRequestException({
        code: 'FULL_NAME_REQUIRED',
        message: 'Full name is required',
      });
    }

    return normalizedFullName;
  }

  private normalizePassword(password: string): string {
    const normalizedPassword = password?.trim();

    if (!normalizedPassword || normalizedPassword.length < 8) {
      throw new BadRequestException({
        code: 'PASSWORD_INVALID',
        message: 'Password must be at least 8 characters long',
      });
    }

    return normalizedPassword;
  }

  private toAuthUser(user: UserEntity): AuthUser {
    const roles = user.userRoles
      .map((userRole) => userRole.role?.name)
      .filter((roleName): roleName is string => Boolean(roleName));
    const permissions = user.userRoles
      .flatMap((userRole) => userRole.role?.rolePermissions ?? [])
      .map((rolePermission) => rolePermission.permission?.name)
      .filter((permissionName): permissionName is string =>
        Boolean(permissionName),
      );

    return {
      email: user.email,
      emailVerified: !!user.emailVerifiedAt,
      isActive: user.isActive,
      permissions: [...new Set(permissions)],
      role: roles[0],
      roles: [...new Set(roles)],
      userId: user.id,
    };
  }

  private async verifyPassword(
    password: string,
    storedPasswordHash: string,
  ): Promise<boolean> {
    const [algorithm, salt, hash] = storedPasswordHash.split(':');

    if (algorithm !== 'scrypt' || !salt || !hash) {
      return false;
    }

    const storedHashBuffer = Buffer.from(hash, 'hex');
    const derivedKey = (await scryptAsync(
      password,
      salt,
      storedHashBuffer.length,
    )) as Buffer;

    return timingSafeEqual(storedHashBuffer, derivedKey);
  }
}

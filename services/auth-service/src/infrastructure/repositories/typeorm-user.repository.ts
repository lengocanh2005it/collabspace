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
import { EntityManager, Repository } from 'typeorm';
import type { AuthLiteUser } from '@/domain/entities/auth-lite-user';
import type { AuthUser } from '@/domain/entities/auth-user';
import type { LoginInput } from '@/domain/types/login-input';
import type { RegisterUserInput } from '@/domain/types/register-user-input';
import { User } from '@/domain/entities/user.entity';
import { UserRepository } from '@/domain/repositories/user.repository';
import { RoleOrmEntity } from '@/infrastructure/database/entities/role.orm-entity';
import { UserRoleOrmEntity } from '@/infrastructure/database/entities/user-role.orm-entity';
import { UserOrmEntity } from '@/infrastructure/database/entities/user.orm-entity';

const scryptAsync = promisify(scrypt);

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(RoleOrmEntity)
    private readonly roleRepository: Repository<RoleOrmEntity>,
    @InjectRepository(UserOrmEntity)
    private readonly userRepository: Repository<UserOrmEntity>,
    @InjectRepository(UserRoleOrmEntity)
    private readonly userRoleRepository: Repository<UserRoleOrmEntity>,
  ) {}

  async getAuthUserLiteById(userId: string): Promise<AuthLiteUser> {
    const user = await this.userRepository.findOne({
      select: {
        id: true,
        isActive: true,
        emailVerifiedAt: true,
        deletedAt: true,
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

    return {
      emailVerified: Boolean(user.emailVerifiedAt),
      isActive: user.isActive,
      userId: user.id,
    };
  }

  async getAuthUserById(userId: string): Promise<AuthUser> {
    return this.toAuthUser(await this.loadUserById(userId));
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const normalizedEmail = this.normalizeEmail(email);
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
        email: normalizedEmail,
      },
      withDeleted: true,
    });

    if (!user || user.deletedAt) {
      return null;
    }

    return this.toAuthUser(user);
  }

  async markEmailVerified(
    userId: string,
    manager?: EntityManager,
  ): Promise<AuthUser> {
    const user = await this.loadUserById(userId, manager);

    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      await this.getUserRepository(manager).save(user);
    }

    return this.toAuthUser(user);
  }

  async register(input: RegisterUserInput): Promise<AuthUser> {
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

    const roleNames = ['user'];

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

  async rollbackNewRegistration(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || user.deletedAt || user.emailVerifiedAt) {
      return;
    }

    await this.userRoleRepository.delete({ userId });
    await this.userRepository.softDelete({ id: userId });
  }

  async validateCredentials(input: LoginInput): Promise<AuthUser> {
    const email = this.normalizeEmail(input.email);
    const password = this.normalizePassword(input.password);
    const user = await this.loadUserByEmail(email);

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

    const authUser = this.toAuthUser(user);
    User.fromAuthUser(authUser).assertCanLogin();

    return authUser;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const normalizedCurrentPassword = this.normalizePassword(currentPassword);
    const normalizedNewPassword = this.normalizePassword(newPassword);
    const user = await this.loadUserByIdForWrite(userId);
    const isPasswordValid = await this.verifyPassword(
      normalizedCurrentPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: 'PASSWORD_INVALID',
        message: 'Current password is invalid',
      });
    }

    user.passwordHash = await this.hashPassword(normalizedNewPassword);
    await this.userRepository.save(user);
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const normalizedNewPassword = this.normalizePassword(newPassword);
    const user = await this.loadUserByIdForWrite(userId);
    user.passwordHash = await this.hashPassword(normalizedNewPassword);
    await this.userRepository.save(user);
  }

  private async ensureRole(roleName: string): Promise<RoleOrmEntity> {
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

  private async loadUserByEmail(email: string): Promise<UserOrmEntity> {
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

  private getUserRepository(
    manager?: EntityManager,
  ): Repository<UserOrmEntity> {
    return manager ? manager.getRepository(UserOrmEntity) : this.userRepository;
  }

  private async loadUserByIdForWrite(userId: string): Promise<UserOrmEntity> {
    const user = await this.userRepository.findOne({
      select: {
        id: true,
        isActive: true,
        emailVerifiedAt: true,
        deletedAt: true,
        passwordHash: true,
      },
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `User ${userId} was not found`,
      });
    }

    return user;
  }

  private async loadUserById(
    userId: string,
    manager?: EntityManager,
  ): Promise<UserOrmEntity> {
    const user = await this.getUserRepository(manager).findOne({
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

  private toAuthUser(user: UserOrmEntity): AuthUser {
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
      createdAt: user.createdAt,
      email: user.email,
      emailVerified: !!user.emailVerifiedAt,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
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

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import type {
  AuthUser,
  LoginInput,
  RegisterInput,
} from '@/common/types/identity.type';
import { User } from '@/domain/entities/user.entity';
import { UserRepository } from '@/domain/repositories/user.repository';

const scryptAsync = promisify(scrypt);

type StoredUser = AuthUser & {
  passwordHash: string;
  deletedAt: Date | null;
};

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, StoredUser>();

  async getAuthUserById(userId: string): Promise<AuthUser> {
    const user = this.users.get(userId);

    if (!user || user.deletedAt) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `User ${userId} was not found`,
      });
    }

    return this.toAuthUser(user);
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = [...this.users.values()].find(
      (candidate) => candidate.email === normalizedEmail && !candidate.deletedAt,
    );

    return user ? this.toAuthUser(user) : null;
  }

  async markEmailVerified(userId: string): Promise<AuthUser> {
    const user = await this.getStoredUser(userId);

    if (!user.emailVerified) {
      user.emailVerified = true;
      this.users.set(userId, user);
    }

    return this.toAuthUser(user);
  }

  async register(input: RegisterInput): Promise<AuthUser> {
    const email = this.normalizeEmail(input.email);
    this.normalizeFullName(input.fullName);
    const password = this.normalizePassword(input.password);
    const existingUser = [...this.users.values()].find(
      (candidate) => candidate.email === email,
    );

    if (existingUser && !existingUser.deletedAt) {
      throw new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message: `User ${email} already exists`,
      });
    }

    const userId = randomUUID();
    const storedUser: StoredUser = {
      deletedAt: null,
      email,
      emailVerified: false,
      isActive: true,
      passwordHash: await this.hashPassword(password),
      permissions: [],
      role: 'user',
      roles: ['user'],
      userId,
    };
    this.users.set(userId, storedUser);

    return this.toAuthUser(storedUser);
  }

  async rollbackNewRegistration(userId: string): Promise<void> {
    const user = this.users.get(userId);

    if (!user || user.deletedAt || user.emailVerified) {
      return;
    }

    user.deletedAt = new Date();
    this.users.set(userId, user);
  }

  async validateCredentials(input: LoginInput): Promise<AuthUser> {
    const email = this.normalizeEmail(input.email);
    const password = this.normalizePassword(input.password);
    const user = [...this.users.values()].find(
      (candidate) => candidate.email === email && !candidate.deletedAt,
    );

    if (!user) {
      throw new UnauthorizedException({
        code: 'LOGIN_INVALID',
        message: 'Email or password is invalid',
      });
    }

    const isPasswordValid = await this.verifyPassword(password, user.passwordHash);

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
    const user = await this.getStoredUser(userId);
    const normalizedCurrentPassword = this.normalizePassword(currentPassword);
    const normalizedNewPassword = this.normalizePassword(newPassword);
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
    this.users.set(userId, user);
  }

  private async getStoredUser(userId: string): Promise<StoredUser> {
    const user = this.users.get(userId);

    if (!user || user.deletedAt) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `User ${userId} was not found`,
      });
    }

    return user;
  }

  private toAuthUser(user: StoredUser): AuthUser {
    return {
      email: user.email,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      permissions: user.permissions,
      role: user.role,
      roles: user.roles,
      userId: user.userId,
    };
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

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `scrypt:${salt}:${derivedKey.toString('hex')}`;
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

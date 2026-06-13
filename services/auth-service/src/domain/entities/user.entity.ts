import type { AuthUser } from '@/domain/entities/auth-user';
import { UnauthorizedException } from '@nestjs/common';

export class User {
  constructor(
    readonly userId: string,
    readonly email: string,
    readonly emailVerified: boolean,
    readonly isActive: boolean,
    readonly permissions: string[],
    readonly role?: string,
    readonly roles: string[] = [],
  ) {}

  static fromAuthUser(authUser: AuthUser): User {
    return new User(
      authUser.userId,
      authUser.email,
      authUser.emailVerified,
      authUser.isActive,
      authUser.permissions,
      authUser.role,
      authUser.roles,
    );
  }

  toAuthUser(): AuthUser {
    return {
      email: this.email,
      emailVerified: this.emailVerified,
      isActive: this.isActive,
      permissions: this.permissions,
      role: this.role,
      roles: this.roles,
      userId: this.userId,
    };
  }

  assertCanLogin(): void {
    if (!this.isActive) {
      throw new UnauthorizedException({
        code: 'USER_INACTIVE',
        message: 'User account is inactive',
      });
    }

    if (!this.emailVerified) {
      throw new UnauthorizedException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email address has not been verified',
      });
    }
  }
}

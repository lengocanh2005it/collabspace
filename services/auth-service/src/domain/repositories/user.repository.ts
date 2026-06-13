import type { AuthLiteUser } from '@/domain/entities/auth-lite-user';
import type { AuthUser } from '@/domain/entities/auth-user';
import type { LoginInput } from '@/domain/types/login-input';
import type { RegisterUserInput } from '@/domain/types/register-user-input';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  getAuthUserLiteById(userId: string): Promise<AuthLiteUser>;
  getAuthUserById(userId: string): Promise<AuthUser>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  markEmailVerified(userId: string): Promise<AuthUser>;
  register(input: RegisterUserInput): Promise<AuthUser>;
  rollbackNewRegistration(userId: string): Promise<void>;
  validateCredentials(input: LoginInput): Promise<AuthUser>;
  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void>;
}

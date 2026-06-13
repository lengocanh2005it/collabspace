import type {
  AuthUser,
  LoginInput,
  RegisterInput,
} from '@/common/types/identity.type';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  getAuthUserById(userId: string): Promise<AuthUser>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  markEmailVerified(userId: string): Promise<AuthUser>;
  register(input: RegisterInput): Promise<AuthUser>;
  rollbackNewRegistration(userId: string): Promise<void>;
  validateCredentials(input: LoginInput): Promise<AuthUser>;
  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void>;
}

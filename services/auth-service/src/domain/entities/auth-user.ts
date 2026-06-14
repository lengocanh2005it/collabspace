export type AuthUser = {
  createdAt?: Date;
  email: string;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date | null;
  permissions: string[];
  role?: string;
  roles: string[];
  userId: string;
};

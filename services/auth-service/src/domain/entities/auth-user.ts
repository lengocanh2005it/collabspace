export type AuthUser = {
  email: string;
  emailVerified: boolean;
  isActive: boolean;
  permissions: string[];
  role?: string;
  roles: string[];
  userId: string;
};

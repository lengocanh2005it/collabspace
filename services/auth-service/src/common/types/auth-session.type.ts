import type { LoginInput as IdentityLoginInput } from './identity.type';

export type LoginInput = IdentityLoginInput;

export type RefreshSessionInput = {
  refreshToken: string;
};

export type LogoutInput = {
  refreshToken: string;
};

export type AuthSession = {
  accessToken: string;
  email: string;
  expiresIn: string;
  refreshToken: string;
  role?: string;
  roles: string[];
  userId: string;
  workspaceId?: string | null;
};

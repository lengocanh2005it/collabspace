import type { LoginInput as IdentityLoginInput } from './identity.type';

export type LoginInput = IdentityLoginInput;

export type RefreshSessionInput = {
  refreshToken: string;
};

export type LogoutInput = {
  refreshToken: string;
};

export type LogoutOtherSessionsInput = {
  refreshToken: string;
};

export type AuthSessionInfo = {
  expiresAt: string;
  familyId: string;
  isActive: boolean;
  lastUsedAt?: string | null;
  revokeReason?: string | null;
  revokedAt?: string | null;
  tokenId: string;
  userId: string;
  workspaceId?: string | null;
};

export type RevokeSessionResult = {
  revokedCount: number;
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

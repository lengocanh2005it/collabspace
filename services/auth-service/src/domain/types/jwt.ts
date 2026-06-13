import type { JWTPayload } from 'jose';

export type JwtPayload = JWTPayload & {
  role?: string;
  roles?: string[] | string;
  userId?: string;
  user_id?: string;
  workspaceId?: string;
  workspace_id?: string;
  tenantId?: string;
  tenant_id?: string;
};

export type AuthIdentity = {
  emailVerified: boolean;
  fullName?: string;
  permissions: string[];
  profileStatus?: 'available' | 'unavailable';
  roles: string[];
  role?: string;
  username?: string;
  workspaceId?: string;
  userId: string;
};

/** Lightweight identity for downstream guards (no profile, no permission graph). */
export type AuthLiteIdentity = {
  emailVerified: boolean;
  role?: string;
  roles: string[];
  userId: string;
  workspaceId?: string;
};

export type SignAccessTokenInput = {
  roles?: string[];
  role?: string;
  workspaceId?: string;
  userId: string;
};

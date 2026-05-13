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
  roles: string[];
  role?: string;
  username?: string;
  workspaceId?: string;
  userId: string;
};

export type SignAccessTokenInput = {
  roles?: string[];
  role?: string;
  workspaceId?: string;
  userId: string;
};

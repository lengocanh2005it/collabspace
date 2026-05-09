export type VerifyAccessTokenRequest = {
  authorization?: string;
};

export type VerifyAccessTokenResponse = {
  authenticated: boolean;
  emailVerified: boolean;
  permissions: string[];
  role?: string;
  roles: string[];
  userId: string;
  workspaceId?: string;
};

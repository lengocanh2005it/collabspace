export type VerifyAccessTokenRequest = {
  authorization?: string;
};

export type VerifyAccessTokenResponse = {
  authenticated: boolean;
  role?: string;
  userId: string;
  workspaceId?: string;
};

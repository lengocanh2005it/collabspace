export type LoginInput = {
  role?: string;
  userId: string;
  workspaceId?: string;
};

export type RefreshSessionInput = {
  refreshToken: string;
};

export type LogoutInput = {
  refreshToken: string;
};

export type AuthSession = {
  accessToken: string;
  expiresIn: string;
  refreshToken: string;
  role?: string;
  userId: string;
  workspaceId?: string | null;
};

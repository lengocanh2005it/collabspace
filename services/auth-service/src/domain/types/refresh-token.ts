export type IssueRefreshTokenInput = {
  expiresAt?: Date;
  familyId?: string;
  parentTokenId?: string | null;
  userId: string;
  workspaceId?: string | null;
};

export type RefreshTokenPayload = {
  expiresAt: Date;
  familyId: string;
  refreshToken: string;
  tokenId: string;
  userId: string;
  workspaceId?: string | null;
};

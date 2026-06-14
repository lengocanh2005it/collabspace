export type RefreshTokenSessionSummary = {
  tokenId: string;
  familyId: string;
  userId: string;
  workspaceId: string | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
};

import type { IssueRefreshTokenInput, RefreshTokenPayload } from '@/domain/types/refresh-token';
import type { RefreshTokenSessionSummary } from '@/domain/types/refresh-token-session';

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface RefreshTokenRepository {
  issue(input: IssueRefreshTokenInput): Promise<RefreshTokenPayload>;
  listSessionsByUserId(userId: string): Promise<RefreshTokenSessionSummary[]>;
  revokeAllForUser(userId: string, reason?: string): Promise<number>;
  revokeFamilyForUser(userId: string, familyId: string, reason?: string): Promise<number>;
  revokeOtherFamiliesForUser(
    userId: string,
    refreshToken: string,
    reason?: string,
  ): Promise<number>;
  revokeToken(refreshToken: string, reason?: string): Promise<void>;
  rotate(refreshToken: string): Promise<RefreshTokenPayload>;
}

import {
  IssueRefreshTokenInput,
  RefreshTokenPayload,
} from '@/common/types/refresh-token.type';

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface RefreshTokenRepository {
  issue(input: IssueRefreshTokenInput): Promise<RefreshTokenPayload>;
  rotate(refreshToken: string): Promise<RefreshTokenPayload>;
  revokeToken(refreshToken: string, reason?: string): Promise<void>;
  revokeAllForUser(userId: string, reason?: string): Promise<number>;
}

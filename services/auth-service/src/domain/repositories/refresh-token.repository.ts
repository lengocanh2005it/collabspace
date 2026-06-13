import type {
  IssueRefreshTokenInput,
  RefreshTokenPayload,
} from '@/domain/types/refresh-token';

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface RefreshTokenRepository {
  issue(input: IssueRefreshTokenInput): Promise<RefreshTokenPayload>;
  revokeAllForUser(userId: string, reason?: string): Promise<number>;
  revokeToken(refreshToken: string, reason?: string): Promise<void>;
  rotate(refreshToken: string): Promise<RefreshTokenPayload>;
}

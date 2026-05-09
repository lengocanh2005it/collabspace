import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserStatus } from '../../domain/entities/user-status.entity';

export type UserSummaryResponseDto = {
  avatarUrl: string | null;
  displayName: string | null;
  fullName: string;
  status: string;
  userId: string;
  username: string | null;
};

export const toUserSummaryResponseDto = (
  profile: UserProfile,
  status?: UserStatus,
): UserSummaryResponseDto => ({
  avatarUrl: profile.avatarUrl,
  displayName: profile.displayName,
  fullName: profile.fullName,
  status: status?.status ?? 'offline',
  userId: profile.userId,
  username: profile.username,
});

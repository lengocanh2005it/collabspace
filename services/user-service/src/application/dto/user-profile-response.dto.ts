import type { UserProfile } from '../../domain/entities/user-profile.entity';
import type { UserStatus } from '../../domain/entities/user-status.entity';

export type UserProfileResponseDto = {
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  displayName: string | null;
  fullName: string;
  id: string;
  status: string;
  updatedAt: string;
  userId: string;
  username: string | null;
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export const toUserProfileResponseDto = (
  profile: UserProfile,
  status?: UserStatus,
): UserProfileResponseDto => ({
  avatarUrl: profile.avatarUrl,
  bio: profile.bio,
  createdAt: toIsoString(profile.createdAt),
  displayName: profile.displayName,
  fullName: profile.fullName,
  id: profile.id,
  status: status?.status ?? 'offline',
  updatedAt: toIsoString(profile.updatedAt),
  userId: profile.userId,
  username: profile.username,
});

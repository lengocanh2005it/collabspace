import { UserProfile } from '../../domain/entities/user-profile.entity';

export type UserProfileResponseDto = {
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  displayName: string | null;
  fullName: string;
  id: string;
  updatedAt: string;
  userId: string;
  username: string | null;
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export const toUserProfileResponseDto = (
  profile: UserProfile,
): UserProfileResponseDto => ({
  avatarUrl: profile.avatarUrl,
  bio: profile.bio,
  createdAt: toIsoString(profile.createdAt),
  displayName: profile.displayName,
  fullName: profile.fullName,
  id: profile.id,
  updatedAt: toIsoString(profile.updatedAt),
  userId: profile.userId,
  username: profile.username,
});

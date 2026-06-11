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

export const toUserProfileResponseDto = (
  profile: UserProfile,
): UserProfileResponseDto => ({
  avatarUrl: profile.avatarUrl,
  bio: profile.bio,
  createdAt: profile.createdAt.toISOString(),
  displayName: profile.displayName,
  fullName: profile.fullName,
  id: profile.id,
  updatedAt: profile.updatedAt.toISOString(),
  userId: profile.userId,
  username: profile.username,
});

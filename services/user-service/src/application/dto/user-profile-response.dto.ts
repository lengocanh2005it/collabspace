import { UserProfile } from '../../domain/entities/user-profile.entity';

export type UserProfileResponseDto = {
  avatarUrl: string | null;
  bio: string | null;
  coverUrl: string | null;
  createdAt: string;
  department: string | null;
  displayName: string | null;
  emailVerified: boolean;
  fullName: string;
  id: string;
  jobTitle: string | null;
  locale: string | null;
  location: string | null;
  timezone: string | null;
  updatedAt: string;
  userId: string;
  username: string | null;
};

export const toUserProfileResponseDto = (
  profile: UserProfile,
): UserProfileResponseDto => ({
  avatarUrl: profile.avatarUrl,
  bio: profile.bio,
  coverUrl: profile.coverUrl,
  createdAt: profile.createdAt.toISOString(),
  department: profile.department,
  displayName: profile.displayName,
  emailVerified: profile.emailVerified,
  fullName: profile.fullName,
  id: profile.id,
  jobTitle: profile.jobTitle,
  locale: profile.locale,
  location: profile.location,
  timezone: profile.timezone,
  updatedAt: profile.updatedAt.toISOString(),
  userId: profile.userId,
  username: profile.username,
});

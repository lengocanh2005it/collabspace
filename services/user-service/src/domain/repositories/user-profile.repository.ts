import { UserProfile } from '../entities/user-profile.entity';
import { UserPreferences } from '../entities/user-preferences.entity';
import { UserStatus } from '../entities/user-status.entity';

export const USER_PROFILE_REPOSITORY = Symbol('USER_PROFILE_REPOSITORY');

export type CreatePendingUserProfileInput = {
  fullName: string;
  userId: string;
};

export type ListUserProfilesInput = {
  limit?: number;
  offset?: number;
  q?: string;
};

export type ListUserProfilesResult = {
  items: UserProfile[];
  limit: number;
  offset: number;
  total: number;
};

export type UpdateUserProfileInput = {
  avatarUrl?: string | null;
  bio?: string | null;
  displayName?: string | null;
  fullName?: string;
  username?: string | null;
};

export type UpdateUserPreferencesInput = {
  dateFormat?: string;
  desktopNotificationsEnabled?: boolean;
  digestFrequency?: string;
  emailNotificationsEnabled?: boolean;
  language?: string;
  pushNotificationsEnabled?: boolean;
  theme?: string;
  timeFormat?: string;
  timezone?: string | null;
  weekStartsOn?: string;
};

export type UpdateUserStatusInput = {
  clearAt?: Date | null;
  emoji?: string | null;
  lastSeenAt?: Date | null;
  status?: string;
  statusText?: string | null;
};

export interface UserProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
  findByUsername(username: string): Promise<UserProfile | null>;
  findManyByUserIds(userIds: string[]): Promise<UserProfile[]>;
  getPreferences(userId: string): Promise<UserPreferences>;
  getStatus(userId: string): Promise<UserStatus>;
  getStatusesByUserIds(userIds: string[]): Promise<UserStatus[]>;
  list(input: ListUserProfilesInput): Promise<ListUserProfilesResult>;
  anonymize(userId: string): Promise<void>;
  updatePreferences(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences>;
  updateProfile(
    userId: string,
    input: UpdateUserProfileInput,
  ): Promise<UserProfile>;
  updateStatus(
    userId: string,
    input: UpdateUserStatusInput,
  ): Promise<UserStatus>;
  upsertPending(input: CreatePendingUserProfileInput): Promise<UserProfile>;
}

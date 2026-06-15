import type { UserPreferences } from '../../domain/entities/user-preferences.entity';

export type UserPreferencesResponseDto = {
  createdAt: string;
  dateFormat: string;
  desktopNotificationsEnabled: boolean;
  digestFrequency: string;
  emailNotificationsEnabled: boolean;
  language: string;
  pushNotificationsEnabled: boolean;
  theme: string;
  timeFormat: string;
  timezone: string | null;
  updatedAt: string;
  userId: string;
  weekStartsOn: string;
};

export const toUserPreferencesResponseDto = (
  preferences: UserPreferences,
): UserPreferencesResponseDto => ({
  createdAt: preferences.createdAt.toISOString(),
  dateFormat: preferences.dateFormat,
  desktopNotificationsEnabled: preferences.desktopNotificationsEnabled,
  digestFrequency: preferences.digestFrequency,
  emailNotificationsEnabled: preferences.emailNotificationsEnabled,
  language: preferences.language,
  pushNotificationsEnabled: preferences.pushNotificationsEnabled,
  theme: preferences.theme,
  timeFormat: preferences.timeFormat,
  timezone: preferences.timezone,
  updatedAt: preferences.updatedAt.toISOString(),
  userId: preferences.userId,
  weekStartsOn: preferences.weekStartsOn,
});

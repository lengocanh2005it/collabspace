import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserPreferences } from '../../domain/entities/user-preferences.entity';
import { UserStatus } from '../../domain/entities/user-status.entity';
import type {
  CreatePendingUserProfileInput,
  ListUserProfilesInput,
  ListUserProfilesResult,
  UpdateUserPreferencesInput,
  UpdateUserProfileInput,
  UpdateUserStatusInput,
  UserProfileRepository,
} from '../../domain/repositories/user-profile.repository';

@Injectable()
export class InMemoryUserProfileRepository implements UserProfileRepository {
  private profiles = [
    new UserProfile(
      'profile-1',
      'user-1',
      'jane.doe',
      'Jane Doe',
      'Jane',
      'https://cdn.example.com/avatar-1.png',
      'Product designer',
      null,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
    ),
    new UserProfile(
      'profile-2',
      'user-2',
      'john.smith',
      'John Smith',
      null,
      null,
      null,
      null,
      new Date('2026-01-03T00:00:00.000Z'),
      new Date('2026-01-04T00:00:00.000Z'),
    ),
  ];

  private preferences = [
    new UserPreferences(
      'user-1',
      'system',
      'vi',
      'Asia/Saigon',
      'YYYY-MM-DD',
      '24h',
      'monday',
      true,
      true,
      true,
      'daily',
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
    ),
    new UserPreferences(
      'user-2',
      'light',
      'en',
      'UTC',
      'YYYY-MM-DD',
      '12h',
      'sunday',
      true,
      false,
      true,
      'weekly',
      new Date('2026-01-03T00:00:00.000Z'),
      new Date('2026-01-04T00:00:00.000Z'),
    ),
  ];

  private statuses = [
    new UserStatus(
      'user-1',
      'online',
      'Reviewing tasks',
      ':memo:',
      null,
      new Date('2026-01-02T08:30:00.000Z'),
      new Date('2026-01-02T08:30:00.000Z'),
    ),
    new UserStatus(
      'user-2',
      'away',
      null,
      null,
      null,
      new Date('2026-01-04T10:00:00.000Z'),
      new Date('2026-01-04T10:00:00.000Z'),
    ),
  ];

  async findByUserId(userId: string): Promise<UserProfile | null> {
    return this.profiles.find((profile) => profile.userId === userId) ?? null;
  }

  async findByUsername(username: string): Promise<UserProfile | null> {
    const normalized = username.trim().toLowerCase();
    return (
      this.profiles.find(
        (profile) => profile.deletedAt === null && profile.username?.toLowerCase() === normalized,
      ) ?? null
    );
  }

  async findManyByUserIds(userIds: string[]): Promise<UserProfile[]> {
    const userIdSet = new Set(userIds);
    return this.profiles.filter((profile) => userIdSet.has(profile.userId));
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const existingPreferences = this.preferences.find(
      (preferences) => preferences.userId === userId,
    );

    if (existingPreferences) {
      return existingPreferences;
    }

    const defaults = this.buildDefaultPreferences(userId);
    this.preferences.push(defaults);
    return defaults;
  }

  async getStatus(userId: string): Promise<UserStatus> {
    const existingStatus = this.statuses.find((status) => status.userId === userId);

    if (existingStatus) {
      return existingStatus;
    }

    const defaults = this.buildDefaultStatus(userId);
    this.statuses.push(defaults);
    return defaults;
  }

  async getStatusesByUserIds(userIds: string[]): Promise<UserStatus[]> {
    const results: UserStatus[] = [];

    for (const userId of userIds) {
      results.push(await this.getStatus(userId));
    }

    return results;
  }

  async list(input: ListUserProfilesInput): Promise<ListUserProfilesResult> {
    const query = input.q?.trim().toLowerCase();
    const offset = Math.max(input.offset ?? 0, 0);
    const limit = Math.max(input.limit ?? 20, 1);
    const filtered = query
      ? this.profiles.filter((profile) =>
          [profile.fullName, profile.displayName, profile.username]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(query)),
        )
      : this.profiles;

    return {
      items: filtered.slice(offset, offset + limit),
      limit,
      offset,
      total: filtered.length,
    };
  }

  async upsertPending(input: CreatePendingUserProfileInput): Promise<UserProfile> {
    const existingProfile = await this.findByUserId(input.userId);
    const now = new Date();

    const profile = new UserProfile(
      existingProfile?.id ?? randomUUID(),
      input.userId,
      existingProfile?.username ??
        (await this.resolveAvailableUsername(input.fullName, input.userId)),
      input.fullName,
      existingProfile?.displayName ?? null,
      existingProfile?.avatarUrl ?? null,
      existingProfile?.bio ?? null,
      null,
      existingProfile?.createdAt ?? now,
      now,
    );

    if (existingProfile) {
      this.profiles = this.profiles.map((item) => (item.userId === input.userId ? profile : item));
      return profile;
    }

    this.profiles.push(profile);
    return profile;
  }

  async updateProfile(userId: string, input: UpdateUserProfileInput): Promise<UserProfile> {
    const profile = await this.findByUserId(userId);

    if (!profile) {
      throw new NotFoundException({
        code: 'USER_PROFILE_NOT_FOUND',
        message: `Profile for user ${userId} was not found`,
      });
    }

    const updatedProfile = new UserProfile(
      profile.id,
      profile.userId,
      input.username === undefined ? profile.username : input.username,
      input.fullName ?? profile.fullName,
      input.displayName === undefined ? profile.displayName : input.displayName,
      input.avatarUrl === undefined ? profile.avatarUrl : input.avatarUrl,
      input.bio === undefined ? profile.bio : input.bio,
      profile.deletedAt,
      profile.createdAt,
      new Date(),
    );

    this.profiles = this.profiles.map((item) => (item.userId === userId ? updatedProfile : item));

    return updatedProfile;
  }

  async updatePreferences(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences> {
    const preferences = await this.getPreferences(userId);
    const updatedPreferences = new UserPreferences(
      userId,
      input.theme ?? preferences.theme,
      input.language ?? preferences.language,
      input.timezone === undefined ? preferences.timezone : input.timezone,
      input.dateFormat ?? preferences.dateFormat,
      input.timeFormat ?? preferences.timeFormat,
      input.weekStartsOn ?? preferences.weekStartsOn,
      input.emailNotificationsEnabled ?? preferences.emailNotificationsEnabled,
      input.pushNotificationsEnabled ?? preferences.pushNotificationsEnabled,
      input.desktopNotificationsEnabled ?? preferences.desktopNotificationsEnabled,
      input.digestFrequency ?? preferences.digestFrequency,
      preferences.createdAt,
      new Date(),
    );

    this.preferences = this.preferences.map((item) =>
      item.userId === userId ? updatedPreferences : item,
    );

    if (!this.preferences.some((item) => item.userId === userId)) {
      this.preferences.push(updatedPreferences);
    }

    return updatedPreferences;
  }

  async updateStatus(userId: string, input: UpdateUserStatusInput): Promise<UserStatus> {
    const status = await this.getStatus(userId);
    const updatedStatus = new UserStatus(
      userId,
      input.status ?? status.status,
      input.statusText === undefined ? status.statusText : input.statusText,
      input.emoji === undefined ? status.emoji : input.emoji,
      input.clearAt === undefined ? status.clearAt : input.clearAt,
      input.lastSeenAt === undefined ? status.lastSeenAt : input.lastSeenAt,
      new Date(),
    );

    this.statuses = this.statuses.map((item) => (item.userId === userId ? updatedStatus : item));

    if (!this.statuses.some((item) => item.userId === userId)) {
      this.statuses.push(updatedStatus);
    }

    return updatedStatus;
  }

  private buildDefaultPreferences(userId: string): UserPreferences {
    const now = new Date();

    return new UserPreferences(
      userId,
      'system',
      'en',
      null,
      'YYYY-MM-DD',
      '24h',
      'monday',
      true,
      true,
      true,
      'daily',
      now,
      now,
    );
  }

  private buildDefaultStatus(userId: string): UserStatus {
    return new UserStatus(userId, 'offline', null, null, null, null, new Date());
  }

  private createUsername(fullName: string): string {
    const username = fullName.trim().toLowerCase().replace(/\s+/g, '.');
    return username.length > 0 ? username : 'user';
  }

  private async resolveAvailableUsername(fullName: string, userId: string): Promise<string> {
    const base = this.createUsername(fullName);

    for (let suffix = 0; suffix < 100; suffix += 1) {
      const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
      const taken = await this.findByUsername(candidate);
      if (!taken || taken.userId === userId) {
        return candidate;
      }
    }

    return `${base}-${userId.slice(0, 8)}`;
  }

  async anonymize(userId: string): Promise<void> {
    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException({
        code: 'USER_PROFILE_NOT_FOUND',
        message: `Profile for user ${userId} was not found`,
      });
    }
    const now = new Date();
    const anonymized = new UserProfile(
      profile.id,
      profile.userId,
      `deleted.${userId}`,
      'Deleted user',
      'Deleted user',
      null,
      null,
      now,
      profile.createdAt,
      now,
    );
    this.profiles = this.profiles.map((item) => (item.userId === userId ? anonymized : item));
  }
}

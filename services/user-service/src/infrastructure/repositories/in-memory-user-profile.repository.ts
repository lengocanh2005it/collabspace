import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserPreferences } from '../../domain/entities/user-preferences.entity';
import { UserStatus } from '../../domain/entities/user-status.entity';
import {
  CreatePendingUserProfileInput,
  ListUserProfilesResult,
  ListUserProfilesInput,
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
      null,
      'Product designer',
      'Design Lead',
      'Design',
      'Ho Chi Minh City',
      'Asia/Saigon',
      'vi-VN',
      true,
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
      null,
      null,
      null,
      'UTC',
      'en-US',
      true,
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
          [
            profile.fullName,
            profile.displayName,
            profile.username,
            profile.department,
            profile.jobTitle,
          ]
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

  async markEmailVerified(userId: string): Promise<UserProfile> {
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
      profile.username,
      profile.fullName,
      profile.displayName,
      profile.avatarUrl,
      profile.coverUrl,
      profile.bio,
      profile.jobTitle,
      profile.department,
      profile.location,
      profile.timezone,
      profile.locale,
      true,
      profile.deletedAt,
      profile.createdAt,
      new Date(),
    );

    this.profiles = this.profiles.map((item) =>
      item.userId === userId ? updatedProfile : item,
    );

    return updatedProfile;
  }

  async upsertPending(
    input: CreatePendingUserProfileInput,
  ): Promise<UserProfile> {
    const existingProfile = await this.findByUserId(input.userId);
    const now = new Date();

    const profile = new UserProfile(
      existingProfile?.id ?? randomUUID(),
      input.userId,
      existingProfile?.username ?? this.createUsername(input.fullName),
      input.fullName,
      existingProfile?.displayName ?? null,
      existingProfile?.avatarUrl ?? null,
      existingProfile?.coverUrl ?? null,
      existingProfile?.bio ?? null,
      existingProfile?.jobTitle ?? null,
      existingProfile?.department ?? null,
      existingProfile?.location ?? null,
      existingProfile?.timezone ?? null,
      existingProfile?.locale ?? null,
      existingProfile?.emailVerified ?? false,
      null,
      existingProfile?.createdAt ?? now,
      now,
    );

    if (existingProfile) {
      this.profiles = this.profiles.map((item) =>
        item.userId === input.userId ? profile : item,
      );
      return profile;
    }

    this.profiles.push(profile);
    return profile;
  }

  async updateProfile(
    userId: string,
    input: UpdateUserProfileInput,
  ): Promise<UserProfile> {
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
      profile.avatarUrl,
      input.coverUrl === undefined ? profile.coverUrl : input.coverUrl,
      input.bio === undefined ? profile.bio : input.bio,
      input.jobTitle === undefined ? profile.jobTitle : input.jobTitle,
      input.department === undefined ? profile.department : input.department,
      input.location === undefined ? profile.location : input.location,
      input.timezone === undefined ? profile.timezone : input.timezone,
      input.locale === undefined ? profile.locale : input.locale,
      profile.emailVerified,
      profile.deletedAt,
      profile.createdAt,
      new Date(),
    );

    this.profiles = this.profiles.map((item) =>
      item.userId === userId ? updatedProfile : item,
    );

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
      input.desktopNotificationsEnabled ??
        preferences.desktopNotificationsEnabled,
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

  async updateStatus(
    userId: string,
    input: UpdateUserStatusInput,
  ): Promise<UserStatus> {
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

    this.statuses = this.statuses.map((item) =>
      item.userId === userId ? updatedStatus : item,
    );

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
    return fullName.trim().toLowerCase().replace(/\s+/g, '.');
  }
}

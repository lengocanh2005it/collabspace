import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, Repository } from 'typeorm';
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
import { UserProfileOrmEntity } from '../database/entities/user-profile.orm-entity';
import { UserPreferencesOrmEntity } from '../database/entities/user-preferences.orm-entity';
import { UserStatusOrmEntity } from '../database/entities/user-status.orm-entity';

@Injectable()
export class TypeOrmUserProfileRepository implements UserProfileRepository {
  constructor(
    @InjectRepository(UserProfileOrmEntity)
    private readonly repository: Repository<UserProfileOrmEntity>,
    @InjectRepository(UserPreferencesOrmEntity)
    private readonly preferencesRepository: Repository<UserPreferencesOrmEntity>,
    @InjectRepository(UserStatusOrmEntity)
    private readonly statusRepository: Repository<UserStatusOrmEntity>,
  ) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const profile = await this.repository.findOne({
      where: {
        userId,
      },
    });

    if (!profile) {
      return null;
    }

    return this.toDomainProfile(profile);
  }

  async findByUsername(username: string): Promise<UserProfile | null> {
    const profile = await this.repository
      .createQueryBuilder('profile')
      .where('LOWER(profile.username) = LOWER(:username)', { username })
      .andWhere('profile.deletedAt IS NULL')
      .getOne();

    if (!profile) {
      return null;
    }

    return this.toDomainProfile(profile);
  }

  async findManyByUserIds(userIds: string[]): Promise<UserProfile[]> {
    if (userIds.length === 0) {
      return [];
    }

    const profiles = await this.repository.find({
      where: {
        userId: In(userIds),
      },
    });

    return profiles.map((profile) => this.toDomainProfile(profile));
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const existingPreferences = await this.preferencesRepository.findOne({
      where: {
        userId,
      },
    });

    if (existingPreferences) {
      return this.toDomainPreferences(existingPreferences);
    }

    const defaults = this.preferencesRepository.create({
      dateFormat: 'YYYY-MM-DD',
      desktopNotificationsEnabled: true,
      digestFrequency: 'daily',
      emailNotificationsEnabled: true,
      id: randomUUID(),
      language: 'en',
      pushNotificationsEnabled: true,
      theme: 'system',
      timeFormat: '24h',
      timezone: null,
      userId,
      weekStartsOn: 'monday',
    });

    return this.toDomainPreferences(
      await this.preferencesRepository.save(defaults),
    );
  }

  async getStatus(userId: string): Promise<UserStatus> {
    const existingStatus = await this.statusRepository.findOne({
      where: {
        userId,
      },
    });

    if (existingStatus) {
      return this.toDomainStatus(existingStatus);
    }

    const defaults = this.statusRepository.create({
      clearAt: null,
      emoji: null,
      id: randomUUID(),
      lastSeenAt: null,
      status: 'offline',
      statusText: null,
      userId,
    });

    return this.toDomainStatus(await this.statusRepository.save(defaults));
  }

  async getStatusesByUserIds(userIds: string[]): Promise<UserStatus[]> {
    if (userIds.length === 0) {
      return [];
    }

    const statuses = await this.statusRepository.find({
      where: {
        userId: In(userIds),
      },
    });
    const statusMap = new Map(
      statuses.map((status) => [status.userId, status]),
    );
    const missingUserIds = userIds.filter((id) => !statusMap.has(id));

    if (missingUserIds.length > 0) {
      const newStatuses = await this.statusRepository.save(
        missingUserIds.map((uid) =>
          this.statusRepository.create({
            clearAt: null,
            emoji: null,
            id: randomUUID(),
            lastSeenAt: null,
            status: 'offline',
            statusText: null,
            userId: uid,
          }),
        ),
      );
      for (const s of newStatuses) {
        statusMap.set(s.userId, s);
      }
    }

    return userIds.map((uid) => this.toDomainStatus(statusMap.get(uid)!));
  }

  async list(input: ListUserProfilesInput): Promise<ListUserProfilesResult> {
    const limit = Math.max(input.limit ?? 20, 1);
    const offset = Math.max(input.offset ?? 0, 0);
    const queryBuilder = this.repository
      .createQueryBuilder('profile')
      .orderBy('profile.fullName', 'ASC')
      .take(limit)
      .skip(offset);

    if (input.q?.trim()) {
      const q = `%${input.q.trim().toLowerCase()}%`;
      queryBuilder.andWhere(
        `(
          LOWER(profile.fullName) LIKE :q
          OR LOWER(COALESCE(profile.displayName, '')) LIKE :q
          OR LOWER(COALESCE(profile.username, '')) LIKE :q
        )`,
        { q },
      );
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items: items.map((profile) => this.toDomainProfile(profile)),
      limit,
      offset,
      total,
    };
  }

  async upsertPending(
    input: CreatePendingUserProfileInput,
  ): Promise<UserProfile> {
    const existingProfile = await this.repository.findOne({
      where: {
        userId: input.userId,
      },
    });

    const savedProfile = await this.repository.save(
      this.repository.create({
        avatarUrl: existingProfile?.avatarUrl ?? null,
        bio: existingProfile?.bio ?? null,
        deletedAt: null,
        displayName: existingProfile?.displayName ?? null,
        fullName: input.fullName,
        id: existingProfile?.id ?? randomUUID(),
        userId: input.userId,
        username:
          existingProfile?.username ?? this.createUsername(input.fullName),
      }),
    );

    return this.toDomainProfile(savedProfile);
  }

  async updateProfile(
    userId: string,
    input: UpdateUserProfileInput,
  ): Promise<UserProfile> {
    const profile = await this.repository.findOne({
      where: {
        userId,
      },
    });

    if (!profile) {
      throw new NotFoundException({
        code: 'USER_PROFILE_NOT_FOUND',
        message: `Profile for user ${userId} was not found`,
      });
    }

    profile.avatarUrl = input.avatarUrl === undefined ? profile.avatarUrl : input.avatarUrl;
    profile.bio = input.bio === undefined ? profile.bio : input.bio;
    profile.displayName =
      input.displayName === undefined ? profile.displayName : input.displayName;
    profile.fullName = input.fullName ?? profile.fullName;
    profile.username =
      input.username === undefined ? profile.username : input.username;

    return this.toDomainProfile(await this.repository.save(profile));
  }

  async updatePreferences(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences> {
    const existingPreferences = await this.getPreferencesEntity(userId);
    existingPreferences.dateFormat =
      input.dateFormat ?? existingPreferences.dateFormat;
    existingPreferences.desktopNotificationsEnabled =
      input.desktopNotificationsEnabled ??
      existingPreferences.desktopNotificationsEnabled;
    existingPreferences.digestFrequency =
      input.digestFrequency ?? existingPreferences.digestFrequency;
    existingPreferences.emailNotificationsEnabled =
      input.emailNotificationsEnabled ??
      existingPreferences.emailNotificationsEnabled;
    existingPreferences.language =
      input.language ?? existingPreferences.language;
    existingPreferences.pushNotificationsEnabled =
      input.pushNotificationsEnabled ??
      existingPreferences.pushNotificationsEnabled;
    existingPreferences.theme = input.theme ?? existingPreferences.theme;
    existingPreferences.timeFormat =
      input.timeFormat ?? existingPreferences.timeFormat;
    existingPreferences.timezone =
      input.timezone === undefined
        ? existingPreferences.timezone
        : input.timezone;
    existingPreferences.weekStartsOn =
      input.weekStartsOn ?? existingPreferences.weekStartsOn;

    return this.toDomainPreferences(
      await this.preferencesRepository.save(existingPreferences),
    );
  }

  async updateStatus(
    userId: string,
    input: UpdateUserStatusInput,
  ): Promise<UserStatus> {
    const existingStatus = await this.getStatusEntity(userId);
    existingStatus.clearAt =
      input.clearAt === undefined ? existingStatus.clearAt : input.clearAt;
    existingStatus.emoji =
      input.emoji === undefined ? existingStatus.emoji : input.emoji;
    existingStatus.lastSeenAt =
      input.lastSeenAt === undefined
        ? existingStatus.lastSeenAt
        : input.lastSeenAt;
    existingStatus.status = input.status ?? existingStatus.status;
    existingStatus.statusText =
      input.statusText === undefined
        ? existingStatus.statusText
        : input.statusText;

    return this.toDomainStatus(
      await this.statusRepository.save(existingStatus),
    );
  }

  private async getPreferencesEntity(
    userId: string,
  ): Promise<UserPreferencesOrmEntity> {
    const existingPreferences = await this.preferencesRepository.findOne({
      where: {
        userId,
      },
    });

    if (existingPreferences) {
      return existingPreferences;
    }

    return this.preferencesRepository.create({
      dateFormat: 'YYYY-MM-DD',
      desktopNotificationsEnabled: true,
      digestFrequency: 'daily',
      emailNotificationsEnabled: true,
      id: randomUUID(),
      language: 'en',
      pushNotificationsEnabled: true,
      theme: 'system',
      timeFormat: '24h',
      timezone: null,
      userId,
      weekStartsOn: 'monday',
    });
  }

  private async getStatusEntity(userId: string): Promise<UserStatusOrmEntity> {
    const existingStatus = await this.statusRepository.findOne({
      where: {
        userId,
      },
    });

    if (existingStatus) {
      return existingStatus;
    }

    return this.statusRepository.create({
      clearAt: null,
      emoji: null,
      id: randomUUID(),
      lastSeenAt: null,
      status: 'offline',
      statusText: null,
      userId,
    });
  }

  private toDomainProfile(profile: UserProfileOrmEntity): UserProfile {
    return new UserProfile(
      profile.id,
      profile.userId,
      profile.username,
      profile.fullName,
      profile.displayName,
      profile.avatarUrl,
      profile.bio,
      profile.deletedAt,
      profile.createdAt,
      profile.updatedAt,
    );
  }

  private toDomainPreferences(
    preferences: UserPreferencesOrmEntity,
  ): UserPreferences {
    return new UserPreferences(
      preferences.userId,
      preferences.theme,
      preferences.language,
      preferences.timezone,
      preferences.dateFormat,
      preferences.timeFormat,
      preferences.weekStartsOn,
      preferences.emailNotificationsEnabled,
      preferences.pushNotificationsEnabled,
      preferences.desktopNotificationsEnabled,
      preferences.digestFrequency,
      preferences.createdAt,
      preferences.updatedAt,
    );
  }

  private toDomainStatus(status: UserStatusOrmEntity): UserStatus {
    return new UserStatus(
      status.userId,
      status.status,
      status.statusText,
      status.emoji,
      status.clearAt,
      status.lastSeenAt,
      status.updatedAt,
    );
  }

  private createUsername(fullName: string): string {
    return fullName.trim().toLowerCase().replace(/\s+/g, '.');
  }

  async anonymize(userId: string): Promise<void> {
    const profile = await this.repository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException({
        code: 'USER_PROFILE_NOT_FOUND',
        message: `Profile for user ${userId} was not found`,
      });
    }
    profile.avatarUrl = null;
    profile.bio = null;
    profile.deletedAt = new Date();
    profile.displayName = 'Deleted user';
    profile.fullName = 'Deleted user';
    profile.username = `deleted.${userId}`;
    await this.repository.save(profile);
  }
}

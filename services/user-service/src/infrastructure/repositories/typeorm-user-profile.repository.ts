import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, type EntityManager, type Repository } from 'typeorm';
import type { TransactionContext } from '../../domain/ports/unit-of-work.port';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import { UserPreferences } from '../../domain/entities/user-preferences.entity';
import { UserStatus } from '../../domain/entities/user-status.entity';
import type {
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
import { UserProfileCacheService } from '../cache/user-profile-cache.service';

@Injectable()
export class TypeOrmUserProfileRepository implements UserProfileRepository {
  constructor(
    @InjectRepository(UserProfileOrmEntity)
    private readonly repository: Repository<UserProfileOrmEntity>,
    @InjectRepository(UserPreferencesOrmEntity)
    private readonly preferencesRepository: Repository<UserPreferencesOrmEntity>,
    @InjectRepository(UserStatusOrmEntity)
    private readonly statusRepository: Repository<UserStatusOrmEntity>,
    private readonly cache: UserProfileCacheService,
  ) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const cached = await this.cache.getProfile(userId);
    if (cached !== undefined) return cached;

    const profile = await this.repository.findOne({ where: { userId } });
    const result = profile ? this.toDomainProfile(profile) : null;
    if (result) await this.cache.setProfile(userId, result);
    return result;
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
    if (userIds.length === 0) return [];

    const cached = await this.cache.getManyProfiles(userIds);
    const missing = userIds.filter((id) => !cached.has(id));

    let dbProfiles: UserProfile[] = [];
    if (missing.length > 0) {
      const orms = await this.repository.find({
        where: { userId: In(missing) },
      });
      dbProfiles = orms.map((p) => this.toDomainProfile(p));
      await this.cache.setManyProfiles(dbProfiles);
    }

    const all = new Map<string, UserProfile>([...cached]);
    for (const p of dbProfiles) all.set(p.userId, p);
    return userIds.map((id) => all.get(id)).filter(Boolean) as UserProfile[];
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const cached = await this.cache.getPreferences(userId);
    if (cached !== undefined && cached !== null) return cached;

    const existingPreferences = await this.preferencesRepository.findOne({
      where: { userId },
    });

    if (existingPreferences) {
      const result = this.toDomainPreferences(existingPreferences);
      await this.cache.setPreferences(userId, result);
      return result;
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

    const result = this.toDomainPreferences(await this.preferencesRepository.save(defaults));
    await this.cache.setPreferences(userId, result);
    return result;
  }

  async getStatus(userId: string): Promise<UserStatus> {
    const cached = await this.cache.getStatus(userId);
    if (cached !== undefined && cached !== null) return cached;

    const existingStatus = await this.statusRepository.findOne({
      where: { userId },
    });

    if (existingStatus) {
      const result = this.toDomainStatus(existingStatus);
      await this.cache.setStatus(userId, result);
      return result;
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

    const result = this.toDomainStatus(await this.statusRepository.save(defaults));
    await this.cache.setStatus(userId, result);
    return result;
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
    const statusMap = new Map(statuses.map((status) => [status.userId, status]));
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

    return userIds.map((uid) => {
      const status = statusMap.get(uid);
      if (!status) {
        throw new Error(`Missing user status for ${uid}`);
      }

      return this.toDomainStatus(status);
    });
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

  async upsertPending(input: CreatePendingUserProfileInput): Promise<UserProfile> {
    return this.upsertPendingInTransaction({ manager: this.repository.manager }, input);
  }

  async upsertPendingInTransaction(
    context: TransactionContext,
    input: CreatePendingUserProfileInput,
  ): Promise<UserProfile> {
    const manager = context.manager as EntityManager;
    const repository = manager.getRepository(UserProfileOrmEntity);

    const existingProfile = await repository.findOne({
      where: {
        userId: input.userId,
      },
    });

    let savedProfile: UserProfileOrmEntity;

    if (existingProfile) {
      existingProfile.fullName = input.fullName;
      existingProfile.deletedAt = null;
      if (!existingProfile.username) {
        existingProfile.username = await this.resolveAvailableUsername(
          input.fullName,
          input.userId,
        );
      }
      savedProfile = await repository.save(existingProfile);
    } else {
      savedProfile = await repository.save(
        repository.create({
          avatarUrl: null,
          bio: null,
          deletedAt: null,
          displayName: null,
          fullName: input.fullName,
          id: randomUUID(),
          userId: input.userId,
          username: await this.resolveAvailableUsername(input.fullName, input.userId),
        }),
      );
    }

    await this.cache.deleteProfile(input.userId);
    return this.toDomainProfile(savedProfile);
  }

  async updateProfile(userId: string, input: UpdateUserProfileInput): Promise<UserProfile> {
    return this.updateProfileInTransaction({ manager: this.repository.manager }, userId, input);
  }

  async updateProfileInTransaction(
    context: TransactionContext,
    userId: string,
    input: UpdateUserProfileInput,
  ): Promise<UserProfile> {
    const manager = context.manager as EntityManager;
    const repository = manager.getRepository(UserProfileOrmEntity);
    const profile = await repository.findOne({
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
    profile.displayName = input.displayName === undefined ? profile.displayName : input.displayName;
    profile.fullName = input.fullName ?? profile.fullName;
    profile.username = input.username === undefined ? profile.username : input.username;

    const result = this.toDomainProfile(await repository.save(profile));
    await this.cache.deleteProfile(userId);
    return result;
  }

  async updatePreferences(
    userId: string,
    input: UpdateUserPreferencesInput,
  ): Promise<UserPreferences> {
    const existingPreferences = await this.getPreferencesEntity(userId);
    existingPreferences.dateFormat = input.dateFormat ?? existingPreferences.dateFormat;
    existingPreferences.desktopNotificationsEnabled =
      input.desktopNotificationsEnabled ?? existingPreferences.desktopNotificationsEnabled;
    existingPreferences.digestFrequency =
      input.digestFrequency ?? existingPreferences.digestFrequency;
    existingPreferences.emailNotificationsEnabled =
      input.emailNotificationsEnabled ?? existingPreferences.emailNotificationsEnabled;
    existingPreferences.language = input.language ?? existingPreferences.language;
    existingPreferences.pushNotificationsEnabled =
      input.pushNotificationsEnabled ?? existingPreferences.pushNotificationsEnabled;
    existingPreferences.theme = input.theme ?? existingPreferences.theme;
    existingPreferences.timeFormat = input.timeFormat ?? existingPreferences.timeFormat;
    existingPreferences.timezone =
      input.timezone === undefined ? existingPreferences.timezone : input.timezone;
    existingPreferences.weekStartsOn = input.weekStartsOn ?? existingPreferences.weekStartsOn;

    const result = this.toDomainPreferences(
      await this.preferencesRepository.save(existingPreferences),
    );
    await this.cache.deletePreferences(userId);
    return result;
  }

  async updateStatus(userId: string, input: UpdateUserStatusInput): Promise<UserStatus> {
    const existingStatus = await this.getStatusEntity(userId);
    existingStatus.clearAt = input.clearAt === undefined ? existingStatus.clearAt : input.clearAt;
    existingStatus.emoji = input.emoji === undefined ? existingStatus.emoji : input.emoji;
    existingStatus.lastSeenAt =
      input.lastSeenAt === undefined ? existingStatus.lastSeenAt : input.lastSeenAt;
    existingStatus.status = input.status ?? existingStatus.status;
    existingStatus.statusText =
      input.statusText === undefined ? existingStatus.statusText : input.statusText;

    const result = this.toDomainStatus(await this.statusRepository.save(existingStatus));
    await this.cache.deleteStatus(userId);
    return result;
  }

  private async getPreferencesEntity(userId: string): Promise<UserPreferencesOrmEntity> {
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

  private toDomainPreferences(preferences: UserPreferencesOrmEntity): UserPreferences {
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
    await this.cache.deleteProfile(userId);
  }
}

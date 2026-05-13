import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { UserProfileOrmEntity } from './infrastructure/database/entities/user-profile.orm-entity';
import { UserPreferencesOrmEntity } from './infrastructure/database/entities/user-preferences.orm-entity';
import { UserStatusOrmEntity } from './infrastructure/database/entities/user-status.orm-entity';

type SeedProfile = {
  avatarUrl: string;
  bio: string;
  fullName: string;
  id: string;
  preferredLanguage: string;
  preferredTimezone: string;
  userId: string;
  username: string;
};

const SEED_PROFILES: SeedProfile[] = [
  {
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Phan%20Phu%20Tho',
    bio: 'Infrastructure engineer managing Docker, CI/CD, API gateway, monitoring, tracing, and logging.',
    fullName: 'Phan Phu Tho',
    id: 'a1111111-1111-4111-8111-111111111111',
    preferredLanguage: 'vi',
    preferredTimezone: 'Asia/Saigon',
    userId: '11111111-1111-4111-8111-111111111111',
    username: 'phan.phu.tho',
  },
  {
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Le%20Ngoc%20Anh',
    bio: 'Owns JWT auth, RBAC, and user profile APIs for the collaboration platform.',
    fullName: 'Le Ngoc Anh',
    id: 'b2222222-2222-4222-8222-222222222222',
    preferredLanguage: 'vi',
    preferredTimezone: 'Asia/Saigon',
    userId: '22222222-2222-4222-8222-222222222222',
    username: 'le.ngoc.anh',
  },
  {
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Ngo%20Quang%20Tien',
    bio: 'Builds workspace CRUD flows, member invitations, and workspace membership management.',
    fullName: 'Ngo Quang Tien',
    id: 'c3333333-3333-4333-8333-333333333333',
    preferredLanguage: 'vi',
    preferredTimezone: 'Asia/Saigon',
    userId: '33333333-3333-4333-8333-333333333333',
    username: 'ngo.quang.tien',
  },
  {
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Vo%20Trung%20Tin',
    bio: 'Focuses on task workflows, comments, notifications, and event-driven delivery.',
    fullName: 'Vo Trung Tin',
    id: 'd4444444-4444-4444-8444-444444444444',
    preferredLanguage: 'vi',
    preferredTimezone: 'Asia/Saigon',
    userId: '44444444-4444-4444-8444-444444444444',
    username: 'vo.trung.tin',
  },
  {
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Demo%20Reviewer',
    bio: 'Read-only stakeholder account for reviewing workspace, task, and notification flows in demos.',
    fullName: 'Demo Reviewer',
    id: 'e5555555-5555-4555-8555-555555555555',
    preferredLanguage: 'en',
    preferredTimezone: 'UTC',
    userId: '55555555-5555-4555-8555-555555555555',
    username: 'demo.reviewer',
  },
];

function loadEnvFile(): void {
  const envPath = join(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run user-service seed');
  }

  return databaseUrl;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

async function main(): Promise<void> {
  loadEnvFile();

  const dataSource = new DataSource({
    entities: [
      UserProfileOrmEntity,
      UserPreferencesOrmEntity,
      UserStatusOrmEntity,
    ],
    logging: toBoolean(process.env.DATABASE_LOGGING, false),
    schema: process.env.DATABASE_SCHEMA ?? 'public',
    ssl: toBoolean(process.env.DATABASE_SSL, false)
      ? { rejectUnauthorized: false }
      : false,
    synchronize: false,
    type: 'postgres',
    url: requireDatabaseUrl(),
  });

  await dataSource.initialize();

  try {
    const repository = dataSource.getRepository(UserProfileOrmEntity);
    const preferencesRepository = dataSource.getRepository(
      UserPreferencesOrmEntity,
    );
    const statusRepository = dataSource.getRepository(UserStatusOrmEntity);

    for (const seedProfile of SEED_PROFILES) {
      const existingProfile = await repository.findOne({
        where: {
          userId: seedProfile.userId,
        },
        withDeleted: true,
      });

      await repository.save(
        repository.create({
          avatarUrl: seedProfile.avatarUrl,
          bio: seedProfile.bio,
          deletedAt: null,
          displayName: existingProfile?.displayName ?? seedProfile.fullName,
          fullName: seedProfile.fullName,
          id: existingProfile?.id ?? seedProfile.id,
          userId: seedProfile.userId,
          username: seedProfile.username,
        }),
      );

      const existingPreferences = await preferencesRepository.findOne({
        where: {
          userId: seedProfile.userId,
        },
      });

      await preferencesRepository.save(
        preferencesRepository.create({
          dateFormat: existingPreferences?.dateFormat ?? 'YYYY-MM-DD',
          desktopNotificationsEnabled:
            existingPreferences?.desktopNotificationsEnabled ?? true,
          digestFrequency: existingPreferences?.digestFrequency ?? 'daily',
          emailNotificationsEnabled:
            existingPreferences?.emailNotificationsEnabled ?? true,
          id: existingPreferences?.id ?? randomUUID(),
          language:
            existingPreferences?.language ?? seedProfile.preferredLanguage,
          pushNotificationsEnabled:
            existingPreferences?.pushNotificationsEnabled ?? true,
          theme: existingPreferences?.theme ?? 'system',
          timeFormat: existingPreferences?.timeFormat ?? '24h',
          timezone:
            existingPreferences?.timezone ?? seedProfile.preferredTimezone,
          userId: seedProfile.userId,
          weekStartsOn: existingPreferences?.weekStartsOn ?? 'monday',
        }),
      );

      const existingStatus = await statusRepository.findOne({
        where: {
          userId: seedProfile.userId,
        },
      });

      await statusRepository.save(
        statusRepository.create({
          clearAt: existingStatus?.clearAt ?? null,
          emoji: existingStatus?.emoji ?? null,
          id: existingStatus?.id ?? randomUUID(),
          lastSeenAt: existingStatus?.lastSeenAt ?? new Date(),
          status: existingStatus?.status ?? 'offline',
          statusText: existingStatus?.statusText ?? null,
          userId: seedProfile.userId,
        }),
      );
    }

    console.log('user-service seed completed');
    console.table(
      SEED_PROFILES.map((profile) => ({
        fullName: profile.fullName,
        profileId: profile.id,
        userId: profile.userId,
      })),
    );
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error('user-service seed failed');
  console.error(error);
  process.exitCode = 1;
});

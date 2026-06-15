import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import * as amqp from 'amqplib';
import { DataSource } from 'typeorm';
import { UserProfileOrmEntity } from './infrastructure/database/entities/user-profile.orm-entity';
import { UserPreferencesOrmEntity } from './infrastructure/database/entities/user-preferences.orm-entity';
import { UserStatusOrmEntity } from './infrastructure/database/entities/user-status.orm-entity';
import { avatarUrlFor, loadDemoSeedData, type DemoSeedUser } from './load-demo-seed';

const USER_REGISTERED_EVENT = 'user_registered';
const USER_PROFILE_UPDATED_EVENT = 'user_profile_updated';

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

async function publishUserReplicaEvents(users: DemoSeedUser[]): Promise<void> {
  if (!toBoolean(process.env.RABBITMQ_ENABLED, false)) {
    console.log('RABBITMQ_ENABLED is false — skipping user replica event broadcast.');
    return;
  }

  const rabbitUrl = process.env.RABBITMQ_URL;

  if (!rabbitUrl) {
    console.warn('RABBITMQ_URL is missing — skipping user replica event broadcast.');
    return;
  }

  const connection = await amqp.connect(rabbitUrl);
  const channel = await connection.createChannel();

  try {
    for (const queue of ['task-service', 'notification-service']) {
      await channel.assertQueue(queue, { durable: true });
    }

    for (const user of users) {
      const payload = {
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        displayName: user.fullName,
        avatarUrl: avatarUrlFor(user),
        isActive: true,
      };

      const message = {
        pattern: USER_REGISTERED_EVENT,
        data: payload,
      };

      const body = Buffer.from(JSON.stringify(message));

      for (const queue of ['task-service', 'notification-service']) {
        channel.sendToQueue(queue, body, { persistent: true });
      }

      const profileUpdated = {
        pattern: USER_PROFILE_UPDATED_EVENT,
        data: payload,
      };
      const profileBody = Buffer.from(JSON.stringify(profileUpdated));

      for (const queue of ['task-service', 'notification-service']) {
        channel.sendToQueue(queue, profileBody, { persistent: true });
      }
    }

    console.log(
      `Published ${users.length} user_registered/user_profile_updated events to task-service and notification-service queues.`,
    );
  } finally {
    await channel.close();
    await connection.close();
  }
}

async function seedProfiles(dataSource: DataSource, users: DemoSeedUser[]): Promise<void> {
  const repository = dataSource.getRepository(UserProfileOrmEntity);
  const preferencesRepository = dataSource.getRepository(UserPreferencesOrmEntity);
  const statusRepository = dataSource.getRepository(UserStatusOrmEntity);

  for (const seedProfile of users) {
    const existingProfile = await repository.findOne({
      where: {
        userId: seedProfile.id,
      },
      withDeleted: true,
    });

    await repository.save(
      repository.create({
        avatarUrl: avatarUrlFor(seedProfile),
        bio: seedProfile.bio,
        deletedAt: null,
        displayName: existingProfile?.displayName ?? seedProfile.fullName,
        fullName: seedProfile.fullName,
        id: existingProfile?.id ?? seedProfile.profileId,
        userId: seedProfile.id,
        username: seedProfile.username,
      }),
    );

    const existingPreferences = await preferencesRepository.findOne({
      where: {
        userId: seedProfile.id,
      },
    });

    await preferencesRepository.save(
      preferencesRepository.create({
        dateFormat: existingPreferences?.dateFormat ?? 'YYYY-MM-DD',
        desktopNotificationsEnabled: existingPreferences?.desktopNotificationsEnabled ?? true,
        digestFrequency: existingPreferences?.digestFrequency ?? 'daily',
        emailNotificationsEnabled: existingPreferences?.emailNotificationsEnabled ?? true,
        id: existingPreferences?.id ?? randomUUID(),
        language: existingPreferences?.language ?? seedProfile.preferredLanguage,
        pushNotificationsEnabled: existingPreferences?.pushNotificationsEnabled ?? true,
        theme: existingPreferences?.theme ?? 'system',
        timeFormat: existingPreferences?.timeFormat ?? '24h',
        timezone: existingPreferences?.timezone ?? seedProfile.preferredTimezone,
        userId: seedProfile.id,
        weekStartsOn: existingPreferences?.weekStartsOn ?? 'monday',
      }),
    );

    const existingStatus = await statusRepository.findOne({
      where: {
        userId: seedProfile.id,
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
        userId: seedProfile.id,
      }),
    );
  }
}

async function main(): Promise<void> {
  loadEnvFile();

  const demoData = loadDemoSeedData();
  const dataSource = new DataSource({
    entities: [UserProfileOrmEntity, UserPreferencesOrmEntity, UserStatusOrmEntity],
    logging: toBoolean(process.env.DATABASE_LOGGING, false),
    schema: process.env.DATABASE_SCHEMA ?? 'public',
    ssl: toBoolean(process.env.DATABASE_SSL, false) ? { rejectUnauthorized: false } : false,
    synchronize: false,
    type: 'postgres',
    url: requireDatabaseUrl(),
  });

  await dataSource.initialize();

  try {
    await seedProfiles(dataSource, demoData.users);
    try {
      await publishUserReplicaEvents(demoData.users);
    } catch (error) {
      console.warn(
        'RabbitMQ broadcast failed (task-service seed still upserts replicas directly):',
        error instanceof Error ? error.message : error,
      );
    }

    console.log('user-service seed completed');
    console.table(
      demoData.users.map((profile) => ({
        email: profile.email,
        fullName: profile.fullName,
        userId: profile.id,
        username: profile.username,
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

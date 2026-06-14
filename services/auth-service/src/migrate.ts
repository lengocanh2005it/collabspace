import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { CreateAuthOutboxEvents1718000000001 } from '../migrations/1718000000001-CreateAuthOutboxEvents';
import { AddAuthOutboxRecoveryIndexes1718000000002 } from '../migrations/1718000000002-AddAuthOutboxRecoveryIndexes';
import { RemoveLegacyEmailVerifiedOutboxEvents1718000000003 } from '../migrations/1718000000003-RemoveLegacyEmailVerifiedOutboxEvents';
import { AddLastLoginAt1718000000004 } from '../migrations/1718000000004-AddLastLoginAt';
import { AddRefreshTokenUserExpiresIndex1718000000005 } from '../migrations/1718000000005-AddRefreshTokenUserExpiresIndex';

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
    throw new Error('DATABASE_URL is required to run auth-service migrations');
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
    logging: toBoolean(process.env.DATABASE_LOGGING, false),
    migrations: [
      CreateAuthOutboxEvents1718000000001,
      AddAuthOutboxRecoveryIndexes1718000000002,
      RemoveLegacyEmailVerifiedOutboxEvents1718000000003,
      AddLastLoginAt1718000000004,
      AddRefreshTokenUserExpiresIndex1718000000005,
    ],
    migrationsTableName: 'migrations',
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
    const migrations = await dataSource.runMigrations();

    if (migrations.length === 0) {
      console.log('No auth-service migrations were pending');
      return;
    }

    for (const migration of migrations) {
      console.log(`Applied migration ${migration.name}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error('auth-service migration failed');
  console.error(error);
  process.exitCode = 1;
});

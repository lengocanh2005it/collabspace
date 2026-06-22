import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

/** Load `.env` from cwd when keys are not already set. */
export function loadEnvFile(cwd = process.cwd()): void {
  const envPath = join(cwd, '.env');

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

export function requireDatabaseUrl(): string {
  const databaseUrl = ensureDatabaseUrl();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  return databaseUrl;
}

export function ensureDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.POSTGRES_HOST ?? process.env.DATABASE_HOST;
  const database = process.env.POSTGRES_DB ?? process.env.DATABASE_NAME;
  const username = process.env.POSTGRES_USER ?? process.env.DATABASE_USER ?? 'postgres';
  const password = process.env.POSTGRES_PASSWORD ?? process.env.DATABASE_PASSWORD;
  const port = process.env.POSTGRES_PORT ?? process.env.DATABASE_PORT ?? '5432';

  if (!host || !database || !password) {
    return undefined;
  }

  const encodedUser = encodeURIComponent(username);
  const encodedPassword = encodeURIComponent(password);
  process.env.DATABASE_URL = `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
  return process.env.DATABASE_URL;
}

export function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/** Build absolute glob for TypeORM migrations next to migrate output. */
export function migrationsGlobFromMigrateDir(migrateDirname: string): string {
  const migrationsDir = resolve(migrateDirname, '..', 'migrations');
  const parentName = basename(resolve(migrateDirname, '..'));
  const runningFromSource = basename(migrateDirname) === 'src' && parentName !== 'dist';
  // Require 13-digit JS timestamp prefix (excludes legacy 001-foo files in old images).
  const pattern = runningFromSource
    ? '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-*.{ts,js}'
    : '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-*.js';
  return join(migrationsDir, pattern);
}

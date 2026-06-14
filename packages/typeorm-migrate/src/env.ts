import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

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
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  return databaseUrl;
}

export function toBoolean(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/** Build glob for TypeORM migrations next to compiled migrate output. */
export function migrationsGlobFromMigrateDir(migrateDirname: string): string {
  const migrationsDir = join(migrateDirname, '..', 'migrations');
  const runningFromSource = basename(migrateDirname) === 'src';
  return join(migrationsDir, runningFromSource ? '*.{ts,js}' : '*.js');
}

import { join } from 'node:path';
import {
  ensureDatabaseUrl,
  migrationsGlobFromMigrateDir,
  requireDatabaseUrl,
  toBoolean,
} from './env';

describe('typeorm-migrate env helpers', () => {
  it('migrationsGlobFromMigrateDir requires 13-digit timestamp prefix', () => {
    const fromSrc = migrationsGlobFromMigrateDir(join('/app/services/user-service', 'src'));
    const fromDist = migrationsGlobFromMigrateDir(join('/app/services/user-service/dist', 'src'));
    expect(fromSrc).toContain(
      '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-*.{ts,js}',
    );
    expect(fromDist).toContain(
      '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-*.js',
    );
  });

  it('toBoolean parses common truthy strings', () => {
    expect(toBoolean('true', false)).toBe(true);
    expect(toBoolean('ON', false)).toBe(true);
    expect(toBoolean(undefined, true)).toBe(true);
    expect(toBoolean('false', true)).toBe(false);
  });

  it('requireDatabaseUrl throws when DATABASE_URL is missing', () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(() => requireDatabaseUrl()).toThrow(/DATABASE_URL is required/);
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
  });

  it('ensureDatabaseUrl builds an encoded URL from Postgres parts', () => {
    const originalEnv = {
      DATABASE_URL: process.env.DATABASE_URL,
      POSTGRES_HOST: process.env.POSTGRES_HOST,
      POSTGRES_DB: process.env.POSTGRES_DB,
      POSTGRES_USER: process.env.POSTGRES_USER,
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
      POSTGRES_PORT: process.env.POSTGRES_PORT,
    };

    delete process.env.DATABASE_URL;
    process.env.POSTGRES_HOST = 'postgres-rw';
    process.env.POSTGRES_DB = 'collabspace_auth';
    process.env.POSTGRES_USER = 'postgres';
    process.env.POSTGRES_PASSWORD = 'abc/def+ghi=';
    process.env.POSTGRES_PORT = '5432';

    expect(ensureDatabaseUrl()).toBe(
      'postgresql://postgres:abc%2Fdef%2Bghi%3D@postgres-rw:5432/collabspace_auth',
    );

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
});

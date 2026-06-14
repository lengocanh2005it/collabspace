import { join } from 'node:path';
import {
  migrationsGlobFromMigrateDir,
  requireDatabaseUrl,
  toBoolean,
} from './env';

describe('typeorm-migrate env helpers', () => {
  it('migrationsGlobFromMigrateDir uses ts+js glob from src', () => {
    const glob = migrationsGlobFromMigrateDir(
      join('/app/services/user-service', 'src'),
    );
    expect(glob).toMatch(/migrations[/\\]\*\.\{ts,js\}$/);
  });

  it('migrationsGlobFromMigrateDir uses js glob from dist/src', () => {
    const glob = migrationsGlobFromMigrateDir(
      join('/app/services/user-service/dist', 'src'),
    );
    expect(glob).toMatch(/migrations[/\\]\*\.js$/);
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
    process.env.DATABASE_URL = original;
  });
});

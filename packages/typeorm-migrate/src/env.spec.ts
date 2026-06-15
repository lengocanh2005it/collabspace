import { join } from 'node:path';
import {
  migrationsGlobFromMigrateDir,
  requireDatabaseUrl,
  toBoolean,
} from './env';

describe('typeorm-migrate env helpers', () => {
  it('migrationsGlobFromMigrateDir requires 13-digit timestamp prefix', () => {
    const fromSrc = migrationsGlobFromMigrateDir(
      join('/app/services/user-service', 'src'),
    );
    const fromDist = migrationsGlobFromMigrateDir(
      join('/app/services/user-service/dist', 'src'),
    );
    expect(fromSrc).toContain('[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-*.{ts,js}');
    expect(fromDist).toContain('[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-*.js');
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

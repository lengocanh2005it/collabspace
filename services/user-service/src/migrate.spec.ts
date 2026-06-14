import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSqlStatements, statementUsesConcurrently } from './migrate-sql';

describe('user-service SQL migrations', () => {
  it('parses 003_add_search_indexes.sql into extension + concurrent index statements', () => {
    const sql = readFileSync(
      join(process.cwd(), 'migrations/003_add_search_indexes.sql'),
      'utf8',
    );
    const statements = parseSqlStatements(sql);

    expect(statements).toHaveLength(4);
    expect(statements[0]).toMatch(/CREATE EXTENSION IF NOT EXISTS pg_trgm/i);
    expect(statementUsesConcurrently(statements[0])).toBe(false);
    expect(statements.slice(1).every(statementUsesConcurrently)).toBe(true);
  });

  it('detects CONCURRENTLY case-insensitively', () => {
    expect(
      statementUsesConcurrently('CREATE INDEX concurrently IF NOT EXISTS idx'),
    ).toBe(true);
    expect(
      statementUsesConcurrently('CREATE EXTENSION IF NOT EXISTS pg_trgm'),
    ).toBe(false);
  });
});

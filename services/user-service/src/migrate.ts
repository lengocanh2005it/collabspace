import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource, type EntityManager } from 'typeorm';
import { parseSqlStatements, statementUsesConcurrently } from './migrate-sql';

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
    throw new Error('DATABASE_URL is required to run user-service migrations');
  }

  return databaseUrl;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

async function runStatements(
  runner: Pick<EntityManager, 'query'> | DataSource,
  statements: string[],
): Promise<void> {
  for (const statement of statements) {
    await runner.query(statement);
  }
}

async function applyMigrationFile(
  dataSource: DataSource,
  migrationFile: string,
  sql: string,
): Promise<void> {
  const statements = parseSqlStatements(sql);
  const transactionalStatements = statements.filter(
    (statement) => !statementUsesConcurrently(statement),
  );
  const concurrentStatements = statements.filter((statement) =>
    statementUsesConcurrently(statement),
  );

  if (transactionalStatements.length > 0) {
    await dataSource.transaction(async (manager) => {
      await runStatements(manager, transactionalStatements);
    });
  }

  await runStatements(dataSource, concurrentStatements);

  await dataSource.query(
    'INSERT INTO schema_migrations (filename) VALUES ($1)',
    [migrationFile],
  );
}

async function main(): Promise<void> {
  loadEnvFile();

  const migrationsDir = join(process.cwd(), 'migrations');
  const migrationFiles = existsSync(migrationsDir)
    ? readdirSync(migrationsDir)
        .filter((fileName) => fileName.endsWith('.sql'))
        .sort()
    : [];

  const dataSource = new DataSource({
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
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const executedRows = await dataSource.query(
      'SELECT filename FROM schema_migrations',
    );
    const executedFiles = new Set(executedRows.map((row) => row.filename));

    for (const migrationFile of migrationFiles) {
      if (executedFiles.has(migrationFile)) {
        continue;
      }

      const sql = readFileSync(join(migrationsDir, migrationFile), 'utf8');
      await applyMigrationFile(dataSource, migrationFile, sql);
      console.log(`Applied migration ${migrationFile}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error('user-service migration failed');
  console.error(error);
  process.exitCode = 1;
});

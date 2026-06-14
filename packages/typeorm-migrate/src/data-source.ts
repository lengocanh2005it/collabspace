import { DataSource, type DataSourceOptions } from 'typeorm';
import { requireDatabaseUrl, toBoolean } from './env';

export type CreateMigrateDataSourceOptions = {
  migrationsGlob: string;
  migrationsTableName?: string;
};

export function createMigrateDataSource(
  options: CreateMigrateDataSourceOptions,
): DataSource {
  const config: DataSourceOptions = {
    type: 'postgres',
    url: requireDatabaseUrl(),
    schema: process.env.DATABASE_SCHEMA ?? 'public',
    ssl: toBoolean(process.env.DATABASE_SSL, false)
      ? { rejectUnauthorized: false }
      : false,
    synchronize: false,
    logging: toBoolean(process.env.DATABASE_LOGGING, false),
    migrations: [options.migrationsGlob],
    migrationsTableName: options.migrationsTableName ?? 'migrations',
    migrationsTransactionMode: 'each',
  };

  return new DataSource(config);
}

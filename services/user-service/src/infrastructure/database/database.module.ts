import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UserProfileOrmEntity } from './entities/user-profile.orm-entity';
import { UserPreferencesOrmEntity } from './entities/user-preferences.orm-entity';
import { UserStatusOrmEntity } from './entities/user-status.orm-entity';

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const createDatabaseOptions = (): TypeOrmModuleOptions => ({
  autoLoadEntities: true,
  logging: toBoolean(process.env.DATABASE_LOGGING, false),
  manualInitialization: true,
  retryAttempts: 1,
  retryDelay: 0,
  schema: process.env.DATABASE_SCHEMA ?? 'public',
  ssl: toBoolean(process.env.DATABASE_SSL, false)
    ? { rejectUnauthorized: false }
    : false,
  synchronize: toBoolean(process.env.DATABASE_SYNCHRONIZE, false),
  type: 'postgres',
  url: process.env.DATABASE_URL,
});

@Module({
  imports: [
    TypeOrmModule.forRoot(createDatabaseOptions()),
    TypeOrmModule.forFeature([
      UserProfileOrmEntity,
      UserPreferencesOrmEntity,
      UserStatusOrmEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

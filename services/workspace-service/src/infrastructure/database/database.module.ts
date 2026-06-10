import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { WorkspaceOrmEntity } from './entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from './entities/workspace-member.orm-entity';
import { InvitationOrmEntity } from './entities/invitation.orm-entity';
import { ProjectOrmEntity } from './entities/project.orm-entity';

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
      WorkspaceOrmEntity,
      WorkspaceMemberOrmEntity,
      InvitationOrmEntity,
      ProjectOrmEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

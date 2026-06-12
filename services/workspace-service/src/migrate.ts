import { DataSource } from 'typeorm';
import { WorkspaceOrmEntity } from './infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from './infrastructure/database/entities/workspace-member.orm-entity';
import { ProjectOrmEntity } from './infrastructure/database/entities/project.orm-entity';
import { InvitationOrmEntity } from './infrastructure/database/entities/invitation.orm-entity';
import { WorkspaceActivityOrmEntity } from './infrastructure/database/entities/workspace-activity.orm-entity';
import { WorkspaceOutboxEventEntity } from './infrastructure/outbox/entities/workspace-outbox-event.entity';
import { IdempotencyRecordOrmEntity } from './infrastructure/idempotency/entities/idempotency-record.orm-entity';

const dataSource = new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/collabspace_workspace',
  schema: process.env.DATABASE_SCHEMA || 'public',
  entities: [
    WorkspaceOrmEntity,
    WorkspaceMemberOrmEntity,
    ProjectOrmEntity,
    InvitationOrmEntity,
    WorkspaceActivityOrmEntity,
    WorkspaceOutboxEventEntity,
    IdempotencyRecordOrmEntity,
  ],
  migrations: [__dirname + '/infrastructure/database/migrations/*.ts'],
  synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
});

async function migrate() {
  try {
    await dataSource.initialize();
    console.log('Database connection initialized for migration.');

    if (process.env.DATABASE_SYNCHRONIZE !== 'true') {
      await dataSource.runMigrations();
      console.log('Migrations executed successfully.');
    } else {
      console.log('Schema synchronized automatically based on entities.');
    }

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
migrate();

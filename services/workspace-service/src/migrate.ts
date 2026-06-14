import {
  createMigrateDataSource,
  loadEnvFile,
  migrationsGlobFromMigrateDir,
  runServiceMigrations,
} from '@collabspace/typeorm-migrate';

loadEnvFile();

const dataSource = createMigrateDataSource({
  migrationsGlob: migrationsGlobFromMigrateDir(__dirname),
});

void runServiceMigrations(dataSource).catch((error: unknown) => {
  console.error('workspace-service migration failed');
  console.error(error);
  process.exitCode = 1;
});

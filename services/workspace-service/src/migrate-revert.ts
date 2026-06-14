import {
  createMigrateDataSource,
  loadEnvFile,
  migrationsGlobFromMigrateDir,
  revertLastServiceMigration,
} from '@collabspace/typeorm-migrate';

loadEnvFile();

const dataSource = createMigrateDataSource({
  migrationsGlob: migrationsGlobFromMigrateDir(__dirname),
});

void revertLastServiceMigration(dataSource).catch((error: unknown) => {
  console.error('workspace-service migration revert failed');
  console.error(error);
  process.exitCode = 1;
});

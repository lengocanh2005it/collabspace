import {
  createMigrateDataSource,
  loadEnvFile,
  migrationsGlobFromMigrateDir,
} from '@collabspace/typeorm-migrate';

loadEnvFile();

export default createMigrateDataSource({
  migrationsGlob: migrationsGlobFromMigrateDir(__dirname),
});

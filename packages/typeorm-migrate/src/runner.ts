import type { DataSource } from 'typeorm';

export async function runServiceMigrations(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.initialize();

  try {
    const applied = await dataSource.runMigrations();

    if (applied.length === 0) {
      console.log('No migrations were pending');
      return;
    }

    for (const migration of applied) {
      console.log(`Applied migration ${migration.name}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

export async function revertLastServiceMigration(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.initialize();

  try {
    await dataSource.undoLastMigration();
    console.log('Reverted last migration');
  } finally {
    await dataSource.destroy();
  }
}

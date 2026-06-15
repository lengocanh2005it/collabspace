import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthOutboxRecoveryIndexes1718000000002 implements MigrationInterface {
  name = 'AddAuthOutboxRecoveryIndexes1718000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_outbox_events_claimed
        ON auth_outbox_events (claimed_at)
        WHERE processed_at IS NULL AND failed_at IS NULL AND claimed_at IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_outbox_events_failed
        ON auth_outbox_events (failed_at)
        WHERE processed_at IS NULL AND failed_at IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_auth_outbox_events_failed
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_auth_outbox_events_claimed
    `);
  }
}

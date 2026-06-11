import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthOutboxEvents001 implements MigrationInterface {
  name = 'CreateAuthOutboxEvents001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_outbox_events (
        id UUID PRIMARY KEY,
        event_type VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        claimed_at TIMESTAMPTZ NULL,
        processed_at TIMESTAMPTZ NULL,
        failed_at TIMESTAMPTZ NULL,
        last_error TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_outbox_events_available
        ON auth_outbox_events (available_at)
        WHERE processed_at IS NULL AND failed_at IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_outbox_events_event_type
        ON auth_outbox_events (event_type)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_auth_outbox_events_event_type
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_auth_outbox_events_available
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS auth_outbox_events
    `);
  }
}

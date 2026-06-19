import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserOutboxEvents1718000000104 implements MigrationInterface {
  name = 'CreateUserOutboxEvents1718000000104';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_outbox_events (
        id              UUID PRIMARY KEY,
        aggregate_type  VARCHAR(64) NOT NULL DEFAULT 'User',
        aggregate_id    UUID NOT NULL,
        event_type      VARCHAR NOT NULL,
        payload         JSONB NOT NULL,
        attempt_count   INTEGER NOT NULL DEFAULT 0,
        available_at    TIMESTAMPTZ NOT NULL,
        claimed_at      TIMESTAMPTZ,
        failed_at       TIMESTAMPTZ,
        processed_at    TIMESTAMPTZ,
        last_error      TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_outbox_events_pending
        ON user_outbox_events (processed_at, failed_at, available_at, claimed_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_outbox_events_pending`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_outbox_events`);
  }
}

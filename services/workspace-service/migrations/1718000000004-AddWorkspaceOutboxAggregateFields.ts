import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspaceOutboxAggregateFields1718000000004 implements MigrationInterface {
  name = 'AddWorkspaceOutboxAggregateFields1718000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS workspace_outbox_events (
        id              UUID PRIMARY KEY,
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
      ALTER TABLE workspace_outbox_events
        ADD COLUMN IF NOT EXISTS aggregate_type VARCHAR(64) NOT NULL DEFAULT 'Workspace',
        ADD COLUMN IF NOT EXISTS aggregate_id UUID
    `);

    await queryRunner.query(`
      UPDATE workspace_outbox_events
      SET aggregate_id = (payload->>'workspaceId')::UUID
      WHERE aggregate_id IS NULL
        AND payload ? 'workspaceId'
        AND (payload->>'workspaceId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_workspace_outbox_events_pending
        ON workspace_outbox_events (processed_at, failed_at, available_at, claimed_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_workspace_outbox_events_pending`);
    await queryRunner.query(`
      ALTER TABLE workspace_outbox_events
        DROP COLUMN IF EXISTS aggregate_id,
        DROP COLUMN IF EXISTS aggregate_type
    `);
  }
}

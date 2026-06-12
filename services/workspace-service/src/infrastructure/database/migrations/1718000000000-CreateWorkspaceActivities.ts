import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkspaceActivities1718000000000 implements MigrationInterface {
  name = 'CreateWorkspaceActivities1718000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_activities" (
        "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" UUID NOT NULL,
        "actor_id"     UUID,
        "actor_name"   VARCHAR(150),
        "type"         VARCHAR(50) NOT NULL,
        "summary"      VARCHAR(300) NOT NULL,
        "meta"         JSONB NOT NULL DEFAULT '{}',
        "occurred_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_activities" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_workspace_activities_workspace_occurred"
        ON "workspace_activities" ("workspace_id", "occurred_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_workspace_activities_workspace_occurred"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_activities"`);
  }
}

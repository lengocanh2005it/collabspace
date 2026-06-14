import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1718000000002 implements MigrationInterface {
  name = 'AddPerformanceIndexes1718000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_projects_workspace_deleted"
       ON "projects" ("workspace_id", "is_deleted")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_invitations_workspace_status"
       ON "invitations" ("workspace_id", "status")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_invitations_workspace_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_projects_workspace_deleted"`,
    );
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DemoteWorkspaceAdminsToMember1718000000003 implements MigrationInterface {
  name = 'DemoteWorkspaceAdminsToMember1718000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "workspace_members" SET "role" = 'member' WHERE "role" = 'admin'`,
    );
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Irreversible: former workspace admins cannot be restored without a backup.
  }
}

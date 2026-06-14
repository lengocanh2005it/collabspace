import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspaceSoftDelete1718000000001
  implements MigrationInterface
{
  name = 'AddWorkspaceSoftDelete1718000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "deleted_at"',
    );
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastLoginAt1718000000004 implements MigrationInterface {
  name = 'AddLastLoginAt1718000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "last_login_at"',
    );
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokenUserExpiresIndex1718000000005
  implements MigrationInterface
{
  name = 'AddRefreshTokenUserExpiresIndex1718000000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_refresh_tokens_user_expires"
       ON "refresh_tokens" ("user_id", "expires_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_refresh_tokens_user_expires"`,
    );
  }
}

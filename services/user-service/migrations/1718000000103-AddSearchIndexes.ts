import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchIndexes1718000000103 implements MigrationInterface {
  name = 'AddSearchIndexes1718000000103';

  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_profiles_fullname_trgm"
         ON "profiles" USING GIN (LOWER(full_name) gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_profiles_username_trgm"
         ON "profiles" USING GIN (LOWER(username) gin_trgm_ops)
         WHERE username IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_profiles_displayname_trgm"
         ON "profiles" USING GIN (LOWER(COALESCE(display_name, '')) gin_trgm_ops)
         WHERE display_name IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_profiles_displayname_trgm"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_profiles_username_trgm"`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_profiles_fullname_trgm"`);
  }
}

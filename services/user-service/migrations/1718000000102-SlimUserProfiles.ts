import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SlimUserProfiles1718000000102 implements MigrationInterface {
  name = 'SlimUserProfiles1718000000102';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE profiles DROP COLUMN IF EXISTS cover_url`,
    );
    await queryRunner.query(
      `ALTER TABLE profiles DROP COLUMN IF EXISTS job_title`,
    );
    await queryRunner.query(
      `ALTER TABLE profiles DROP COLUMN IF EXISTS department`,
    );
    await queryRunner.query(
      `ALTER TABLE profiles DROP COLUMN IF EXISTS location`,
    );
    await queryRunner.query(
      `ALTER TABLE profiles DROP COLUMN IF EXISTS timezone`,
    );
    await queryRunner.query(
      `ALTER TABLE profiles DROP COLUMN IF EXISTS locale`,
    );
    await queryRunner.query(
      `ALTER TABLE profiles DROP COLUMN IF EXISTS email_verified`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url VARCHAR(1024)`,
    );
    await queryRunner.query(
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone VARCHAR(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale VARCHAR(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE`,
    );
  }
}

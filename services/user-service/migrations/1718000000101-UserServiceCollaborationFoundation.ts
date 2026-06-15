import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserServiceCollaborationFoundation1718000000101 implements MigrationInterface {
  name = 'UserServiceCollaborationFoundation1718000000101';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL UNIQUE,
        username VARCHAR(255) UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        avatar_url VARCHAR(1024),
        cover_url VARCHAR(1024),
        bio TEXT,
        job_title VARCHAR(255),
        department VARCHAR(255),
        location VARCHAR(255),
        timezone VARCHAR(100),
        locale VARCHAR(50),
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username VARCHAR(255)`);
    await queryRunner.query(
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url VARCHAR(1024)`,
    );
    await queryRunner.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title VARCHAR(255)`);
    await queryRunner.query(
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department VARCHAR(255)`,
    );
    await queryRunner.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone VARCHAR(100)`);
    await queryRunner.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale VARCHAR(50)`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_user_id ON profiles (user_id)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username ON profiles (username)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles (full_name)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL UNIQUE,
        theme VARCHAR(50) NOT NULL DEFAULT 'system',
        language VARCHAR(20) NOT NULL DEFAULT 'en',
        timezone VARCHAR(100),
        date_format VARCHAR(50) NOT NULL DEFAULT 'YYYY-MM-DD',
        time_format VARCHAR(20) NOT NULL DEFAULT '24h',
        week_starts_on VARCHAR(20) NOT NULL DEFAULT 'monday',
        email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        push_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        desktop_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        digest_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_preferences_user_id
        ON user_preferences (user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_status (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'offline',
        status_text VARCHAR(255),
        emoji VARCHAR(50),
        clear_at TIMESTAMPTZ,
        last_seen_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_status_user_id
        ON user_status (user_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_preferences`);
    await queryRunner.query(`DROP TABLE IF EXISTS profiles`);
  }
}

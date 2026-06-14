import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Baseline auth schema (users, roles, refresh_tokens). Runs before incremental migrations. */
export class CreateAuthFoundation1717999999999 implements MigrationInterface {
  name = 'CreateAuthFoundation1717999999999';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY,
        email varchar NOT NULL UNIQUE,
        email_verified_at timestamptz NULL,
        password_hash varchar NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        deleted_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id uuid PRIMARY KEY,
        name varchar NOT NULL UNIQUE,
        description varchar NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id uuid PRIMARY KEY,
        name varchar NOT NULL UNIQUE,
        description varchar NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id uuid NOT NULL,
        role_id uuid NOT NULL,
        PRIMARY KEY (user_id, role_id),
        CONSTRAINT fk_user_roles_user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_roles_role_id
          FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id)`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id uuid NOT NULL,
        permission_id uuid NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        CONSTRAINT fk_role_permissions_role_id
          FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        CONSTRAINT fk_role_permissions_permission_id
          FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions (permission_id)`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id uuid PRIMARY KEY,
        family_id uuid NOT NULL,
        user_id uuid NOT NULL,
        workspace_id uuid NULL,
        token_hash varchar NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz NULL,
        revoke_reason varchar NULL,
        parent_token_id uuid NULL,
        replaced_by_token_id uuid NULL,
        last_used_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash),
        CONSTRAINT fk_refresh_tokens_user_id
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens (family_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS role_permissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS permissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}

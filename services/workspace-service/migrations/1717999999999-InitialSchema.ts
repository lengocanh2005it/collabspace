import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1717999999999 implements MigrationInterface {
  name = 'InitialSchema1717999999999';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspaces" (
        "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
        "name"        VARCHAR(100) NOT NULL,
        "description" TEXT,
        "owner_id"    UUID NOT NULL,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspaces" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_members" (
        "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" UUID NOT NULL,
        "user_id"      UUID NOT NULL,
        "role"         VARCHAR(20) NOT NULL DEFAULT 'member',
        "joined_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_workspace_members_workspace_user" UNIQUE ("workspace_id", "user_id"),
        CONSTRAINT "FK_workspace_members_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "projects" (
        "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" UUID NOT NULL,
        "name"         VARCHAR(100) NOT NULL,
        "description"  TEXT,
        "created_by"   UUID NOT NULL,
        "is_deleted"   BOOLEAN NOT NULL DEFAULT false,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projects" PRIMARY KEY ("id"),
        CONSTRAINT "FK_projects_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invitations" (
        "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id"    UUID NOT NULL,
        "inviter_id"      UUID NOT NULL,
        "invitee_email"   VARCHAR(255) NOT NULL,
        "invitee_user_id" UUID,
        "status"          VARCHAR(20) NOT NULL DEFAULT 'pending',
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at"      TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_invitations_workspace_email_status" UNIQUE ("workspace_id", "invitee_email", "status"),
        CONSTRAINT "FK_invitations_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "idempotency_records" (
        "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
        "user_id"          UUID NOT NULL,
        "idempotency_key"  VARCHAR(255) NOT NULL,
        "route"            VARCHAR(255) NOT NULL,
        "status_code"      INTEGER NOT NULL,
        "response_body"    JSONB NOT NULL,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at"       TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_idempotency_records" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_idempotency_records_user_key" UNIQUE ("user_id", "idempotency_key")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invitations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspaces"`);
  }
}

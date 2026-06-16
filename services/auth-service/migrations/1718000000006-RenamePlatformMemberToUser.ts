import type { MigrationInterface, QueryRunner } from 'typeorm';

const CANONICAL_USER_ROLE_ID = '82000000-0000-4000-8000-000000000002';

/**
 * Simplify platform roles: member → user, deprecate viewer (reassign to user).
 * Registration may have created a duplicate `user` role via ensureRole — merge into canonical seed id.
 */
export class RenamePlatformMemberToUser1718000000006 implements MigrationInterface {
  name = 'RenamePlatformMemberToUser1718000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    const memberRows: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM roles WHERE name = 'member' LIMIT 1`,
    );
    const memberRoleId = memberRows[0]?.id;

    const existingUserRows: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM roles WHERE name = 'user' LIMIT 1`,
    );
    let userRoleId = existingUserRows[0]?.id;

    if (memberRoleId && !userRoleId) {
      await queryRunner.query(
        `
        UPDATE roles
        SET name = 'user',
            description = 'Standard platform user — collaboration APIs; workspace role is separate'
        WHERE id = $1
        `,
        [memberRoleId],
      );
      userRoleId = memberRoleId;
    } else if (memberRoleId && userRoleId && memberRoleId !== userRoleId) {
      await this.reassignUserRoles(queryRunner, memberRoleId, userRoleId);
      await queryRunner.query(`DELETE FROM role_permissions WHERE role_id = $1`, [memberRoleId]);
      await queryRunner.query(`DELETE FROM roles WHERE id = $1`, [memberRoleId]);
    }

    if (!userRoleId) {
      return;
    }

    await this.mergeDuplicateUserRoles(queryRunner, userRoleId);

    const viewerRows: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM roles WHERE name = 'viewer'`,
    );

    for (const viewer of viewerRows) {
      await this.reassignUserRoles(queryRunner, viewer.id, userRoleId);
      await queryRunner.query(`DELETE FROM user_roles WHERE role_id = $1`, [viewer.id]);
      await queryRunner.query(`DELETE FROM role_permissions WHERE role_id = $1`, [viewer.id]);
      await queryRunner.query(`DELETE FROM roles WHERE id = $1`, [viewer.id]);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const userRows: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM roles WHERE name = 'user' AND id = $1 LIMIT 1`,
      [CANONICAL_USER_ROLE_ID],
    );

    if (userRows[0]) {
      await queryRunner.query(
        `
        UPDATE roles
        SET name = 'member',
            description = 'Standard platform collaborator (end-user APIs; workspace owner/member is separate)'
        WHERE id = $1
        `,
        [CANONICAL_USER_ROLE_ID],
      );
    }
  }

  private async reassignUserRoles(
    queryRunner: QueryRunner,
    fromRoleId: string,
    toRoleId: string,
  ): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      SELECT user_id, $2
      FROM user_roles
      WHERE role_id = $1
      ON CONFLICT DO NOTHING
      `,
      [fromRoleId, toRoleId],
    );
    await queryRunner.query(`DELETE FROM user_roles WHERE role_id = $1`, [fromRoleId]);
  }

  private async mergeDuplicateUserRoles(
    queryRunner: QueryRunner,
    canonicalUserRoleId: string,
  ): Promise<void> {
    const duplicateRows: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM roles WHERE name = 'user' AND id <> $1`,
      [canonicalUserRoleId],
    );

    for (const duplicate of duplicateRows) {
      await this.reassignUserRoles(queryRunner, duplicate.id, canonicalUserRoleId);
      await queryRunner.query(`DELETE FROM role_permissions WHERE role_id = $1`, [duplicate.id]);
      await queryRunner.query(`DELETE FROM roles WHERE id = $1`, [duplicate.id]);
    }
  }
}

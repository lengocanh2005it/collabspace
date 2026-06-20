import type { MigrationInterface, QueryRunner } from 'typeorm';

const ADMIN_ROLE_ID = '82000000-0000-4000-8000-000000000001';

const DLQ_PERMISSIONS = [
  {
    description: 'Read DLQ records and retry history',
    id: '81000000-0000-4000-8000-000000000009',
    name: 'dlq.read',
  },
  {
    description: 'Replay, resolve, and discard DLQ records',
    id: '81000000-0000-4000-8000-000000000010',
    name: 'dlq.manage',
  },
];

export class AddDlqPermissions1718000000007 implements MigrationInterface {
  name = 'AddDlqPermissions1718000000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const permission of DLQ_PERMISSIONS) {
      await queryRunner.query(
        `
        INSERT INTO permissions (id, name, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO UPDATE
        SET description = EXCLUDED.description
        `,
        [permission.id, permission.name, permission.description],
      );

      await queryRunner.query(
        `
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, (SELECT id FROM permissions WHERE name = $2))
        ON CONFLICT DO NOTHING
        `,
        [ADMIN_ROLE_ID, permission.name],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const permission of DLQ_PERMISSIONS) {
      await queryRunner.query(
        `
        DELETE FROM role_permissions
        WHERE permission_id = (SELECT id FROM permissions WHERE name = $1)
        `,
        [permission.name],
      );
      await queryRunner.query(`DELETE FROM permissions WHERE name = $1`, [permission.name]);
    }
  }
}

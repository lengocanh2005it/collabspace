import type { MigrationInterface, QueryRunner } from 'typeorm';

const ADMIN_ROLE_ID = '82000000-0000-4000-8000-000000000001';

const ANALYTICS_READ_PERMISSION = {
  description: 'Read platform analytics snapshots and timeseries',
  id: '81000000-0000-4000-8000-000000000011',
  name: 'analytics.read',
};

export class AddAnalyticsPermission1718000000008 implements MigrationInterface {
  name = 'AddAnalyticsPermission1718000000008';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO permissions (id, name, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (name) DO UPDATE
      SET description = EXCLUDED.description
      `,
      [
        ANALYTICS_READ_PERMISSION.id,
        ANALYTICS_READ_PERMISSION.name,
        ANALYTICS_READ_PERMISSION.description,
      ],
    );

    await queryRunner.query(
      `
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES ($1, (SELECT id FROM permissions WHERE name = $2))
      ON CONFLICT DO NOTHING
      `,
      [ADMIN_ROLE_ID, ANALYTICS_READ_PERMISSION.name],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DELETE FROM role_permissions
      WHERE permission_id = (SELECT id FROM permissions WHERE name = $1)
      `,
      [ANALYTICS_READ_PERMISSION.name],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = $1`, [
      ANALYTICS_READ_PERMISSION.name,
    ]);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveLegacyEmailVerifiedOutboxEvents003
  implements MigrationInterface
{
  name = 'RemoveLegacyEmailVerifiedOutboxEvents003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth_outbox_events
      WHERE event_type = 'auth.email_verified'
    `);
  }

  async down(): Promise<void> {
    // Legacy event publishing support was removed. Deleted rows are not restored.
  }
}

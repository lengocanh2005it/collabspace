import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export const AUTH_OUTBOX_EVENT_EMAIL_VERIFICATION_OTP =
  'auth.email_verification_otp';
export const AUTH_OUTBOX_EVENT_PASSWORD_RESET_EMAIL =
  'auth.password_reset_email';

@Entity({ name: 'auth_outbox_events' })
export class AuthOutboxEventEntity {
  @Column({ name: 'attempt_count', default: 0, type: 'integer' })
  attemptCount!: number;

  @Column({ name: 'available_at', type: 'timestamptz' })
  availableAt!: Date;

  @Column({ name: 'claimed_at', nullable: true, type: 'timestamptz' })
  claimedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'event_type', type: 'varchar' })
  eventType!: string;

  @Column({ name: 'failed_at', nullable: true, type: 'timestamptz' })
  failedAt!: Date | null;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'last_error', nullable: true, type: 'text' })
  lastError!: string | null;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'processed_at', nullable: true, type: 'timestamptz' })
  processedAt!: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

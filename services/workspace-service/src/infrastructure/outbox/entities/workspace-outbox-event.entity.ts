import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export const WORKSPACE_OUTBOX_EVENT_WORKSPACE_INVITED =
  'workspace.workspace_invited';

@Entity({ name: 'workspace_outbox_events' })
export class WorkspaceOutboxEventEntity {
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

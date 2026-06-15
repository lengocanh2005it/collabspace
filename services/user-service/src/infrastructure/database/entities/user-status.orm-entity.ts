import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'user_status' })
@Index('UQ_user_status_user_id', ['userId'], { unique: true })
export class UserStatusOrmEntity {
  @Column({ name: 'clear_at', nullable: true, type: 'timestamptz' })
  clearAt!: Date | null;

  @Column({ nullable: true, type: 'varchar' })
  emoji!: string | null;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'last_seen_at', nullable: true, type: 'timestamptz' })
  lastSeenAt!: Date | null;

  @Column({ type: 'varchar', default: 'offline' })
  status!: string;

  @Column({ name: 'status_text', nullable: true, type: 'varchar' })
  statusText!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'idempotency_records' })
@Index(['userId', 'idempotencyKey'], { unique: true })
export class IdempotencyRecordOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey!: string;

  @Column({ type: 'varchar', length: 255 })
  route!: string;

  @Column({ name: 'status_code', type: 'integer' })
  statusCode!: number;

  @Column({ name: 'response_body', type: 'jsonb' })
  responseBody!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { WorkspaceActivityType } from '../../../domain/entities/workspace-activity.entity';

@Entity('workspace_activities')
@Index(['workspace_id', 'occurred_at'])
export class WorkspaceActivityOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspace_id: string;

  @Column({ type: 'uuid', nullable: true })
  actor_id: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  actor_name: string | null;

  @Column({ type: 'varchar', length: 50 })
  type: WorkspaceActivityType;

  @Column({ type: 'varchar', length: 300 })
  summary: string;

  @Column({ type: 'jsonb', default: '{}' })
  meta: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  occurred_at: Date;
}

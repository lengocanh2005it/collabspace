import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { WorkspaceOrmEntity } from './workspace.orm-entity';

@Entity('invitations')
@Unique(['workspace_id', 'invitee_email', 'status'])
@Index('IDX_invitations_workspace_status', ['workspace_id', 'status'])
export class InvitationOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspace_id: string;

  @Column({ type: 'uuid' })
  inviter_id: string;

  @Column({ type: 'varchar', length: 255 })
  invitee_email: string;

  @Column({ type: 'uuid', nullable: true })
  invitee_user_id: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @ManyToOne(() => WorkspaceOrmEntity, (workspace) => workspace.invitations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspace_id' })
  workspace: WorkspaceOrmEntity;
}

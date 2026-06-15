import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { WorkspaceMemberOrmEntity } from './workspace-member.orm-entity';
import { ProjectOrmEntity } from './project.orm-entity';
import { InvitationOrmEntity } from './invitation.orm-entity';

@Entity('workspaces')
export class WorkspaceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid' })
  owner_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @OneToMany(
    () => WorkspaceMemberOrmEntity,
    (member) => member.workspace,
  )
  members: WorkspaceMemberOrmEntity[];

  @OneToMany(
    () => ProjectOrmEntity,
    (project) => project.workspace,
  )
  projects: ProjectOrmEntity[];

  @OneToMany(
    () => InvitationOrmEntity,
    (invitation) => invitation.workspace,
  )
  invitations: InvitationOrmEntity[];
}

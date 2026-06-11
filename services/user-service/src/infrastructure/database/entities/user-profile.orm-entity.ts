import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'profiles' })
@Index('UQ_profiles_user_id', ['userId'], { unique: true })
export class UserProfileOrmEntity {
  @Column({ name: 'avatar_url', nullable: true, type: 'varchar' })
  avatarUrl!: string | null;

  @Column({ nullable: true, type: 'text' })
  bio!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true, type: 'timestamptz' })
  deletedAt!: Date | null;

  @Column({ name: 'display_name', nullable: true, type: 'varchar' })
  displayName!: string | null;

  @Column({ name: 'full_name', type: 'varchar' })
  fullName!: string;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index('UQ_profiles_username', { unique: true })
  @Column({ nullable: true, type: 'varchar' })
  username!: string | null;
}

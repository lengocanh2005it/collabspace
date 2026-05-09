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

  @Column({ name: 'cover_url', nullable: true, type: 'varchar' })
  coverUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ nullable: true, type: 'varchar' })
  department!: string | null;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true, type: 'timestamptz' })
  deletedAt!: Date | null;

  @Column({ name: 'display_name', nullable: true, type: 'varchar' })
  displayName!: string | null;

  @Column({ default: false, name: 'email_verified', type: 'boolean' })
  emailVerified!: boolean;

  @Column({ name: 'full_name', type: 'varchar' })
  fullName!: string;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'job_title', nullable: true, type: 'varchar' })
  jobTitle!: string | null;

  @Column({ nullable: true, type: 'varchar' })
  locale!: string | null;

  @Column({ nullable: true, type: 'varchar' })
  location!: string | null;

  @Column({ nullable: true, type: 'varchar' })
  timezone!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index('UQ_profiles_username', { unique: true })
  @Column({ nullable: true, type: 'varchar' })
  username!: string | null;
}

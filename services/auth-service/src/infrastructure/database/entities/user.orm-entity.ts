import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRoleOrmEntity } from './user-role.orm-entity';

@Entity({ name: 'users' })
@Index('UQ_users_email', ['email'], { unique: true })
export class UserOrmEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true, type: 'timestamptz' })
  deletedAt!: Date | null;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ name: 'email_verified_at', nullable: true, type: 'timestamptz' })
  emailVerifiedAt!: Date | null;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ default: true, name: 'is_active', type: 'boolean' })
  isActive!: boolean;

  @Column({ name: 'last_login_at', nullable: true, type: 'timestamptz' })
  lastLoginAt!: Date | null;

  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(
    () => UserRoleOrmEntity,
    (userRole) => userRole.user,
  )
  userRoles!: UserRoleOrmEntity[];
}

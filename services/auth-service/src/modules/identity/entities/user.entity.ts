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
import { UserRoleEntity } from './user-role.entity';

@Entity({ name: 'users' })
@Index('UQ_users_email', ['email'], { unique: true })
export class UserEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true, type: 'timestamptz' })
  deletedAt!: Date | null;

  @Column({ type: 'varchar' })
  email!: string;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ default: true, name: 'is_active', type: 'boolean' })
  isActive!: boolean;

  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => UserRoleEntity, (userRole) => userRole.user)
  userRoles!: UserRoleEntity[];
}

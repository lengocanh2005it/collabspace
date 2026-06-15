import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { RoleOrmEntity } from './role.orm-entity';
import { UserOrmEntity } from './user.orm-entity';

@Entity({ name: 'user_roles' })
@Index('IDX_user_roles_role_id', ['roleId'])
export class UserRoleOrmEntity {
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(
    () => RoleOrmEntity,
    (role) => role.userRoles,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'role_id' })
  role!: RoleOrmEntity;

  @ManyToOne(
    () => UserOrmEntity,
    (user) => user.userRoles,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'user_id' })
  user!: UserOrmEntity;
}

import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { PermissionOrmEntity } from './permission.orm-entity';
import { RoleOrmEntity } from './role.orm-entity';

@Entity({ name: 'role_permissions' })
@Index('IDX_role_permissions_permission_id', ['permissionId'])
export class RolePermissionOrmEntity {
  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId!: string;

  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(
    () => PermissionOrmEntity,
    (permission) => permission.rolePermissions,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'permission_id' })
  permission!: PermissionOrmEntity;

  @ManyToOne(
    () => RoleOrmEntity,
    (role) => role.rolePermissions,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'role_id' })
  role!: RoleOrmEntity;
}

import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { RolePermissionOrmEntity } from './role-permission.orm-entity';
import { UserRoleOrmEntity } from './user-role.orm-entity';

@Entity({ name: 'roles' })
@Index('UQ_roles_name', ['name'], { unique: true })
export class RoleOrmEntity {
  @Column({ type: 'varchar' })
  description!: string;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @OneToMany(
    () => RolePermissionOrmEntity,
    (rolePermission) => rolePermission.role,
  )
  rolePermissions!: RolePermissionOrmEntity[];

  @OneToMany(
    () => UserRoleOrmEntity,
    (userRole) => userRole.role,
  )
  userRoles!: UserRoleOrmEntity[];
}

import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { RolePermissionEntity } from './role-permission.entity';
import { UserRoleEntity } from './user-role.entity';

@Entity({ name: 'roles' })
@Index('UQ_roles_name', ['name'], { unique: true })
export class RoleEntity {
  @Column({ type: 'varchar' })
  description!: string;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @OneToMany(
    () => RolePermissionEntity,
    (rolePermission) => rolePermission.role,
  )
  rolePermissions!: RolePermissionEntity[];

  @OneToMany(() => UserRoleEntity, (userRole) => userRole.role)
  userRoles!: UserRoleEntity[];
}

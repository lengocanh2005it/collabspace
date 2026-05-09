import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { RolePermissionEntity } from './role-permission.entity';

@Entity({ name: 'permissions' })
@Index('UQ_permissions_name', ['name'], { unique: true })
export class PermissionEntity {
  @Column({ type: 'varchar' })
  description!: string;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @OneToMany(
    () => RolePermissionEntity,
    (rolePermission) => rolePermission.permission,
  )
  rolePermissions!: RolePermissionEntity[];
}

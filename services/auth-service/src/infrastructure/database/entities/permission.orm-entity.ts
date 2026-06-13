import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { RolePermissionOrmEntity } from './role-permission.orm-entity';

@Entity({ name: 'permissions' })
@Index('UQ_permissions_name', ['name'], { unique: true })
export class PermissionOrmEntity {
  @Column({ type: 'varchar' })
  description!: string;

  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @OneToMany(
    () => RolePermissionOrmEntity,
    (rolePermission) => rolePermission.permission,
  )
  rolePermissions!: RolePermissionOrmEntity[];
}

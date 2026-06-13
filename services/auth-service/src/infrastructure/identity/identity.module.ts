import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionOrmEntity } from '@/infrastructure/database/entities/permission.orm-entity';
import { RolePermissionOrmEntity } from '@/infrastructure/database/entities/role-permission.orm-entity';
import { RoleOrmEntity } from '@/infrastructure/database/entities/role.orm-entity';
import { UserRoleOrmEntity } from '@/infrastructure/database/entities/user-role.orm-entity';
import { UserOrmEntity } from '@/infrastructure/database/entities/user.orm-entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserOrmEntity,
      RoleOrmEntity,
      PermissionOrmEntity,
      UserRoleOrmEntity,
      RolePermissionOrmEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class IdentityModule {}

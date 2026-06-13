import { ConfigurationModule } from '@/configuration/configuration.module';
import { ConfigurationService } from '@/configuration/configuration.service';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import {
  USER_PROFILES_GRPC_CLIENT,
  UserProfilesGrpcService,
} from './user-profiles-grpc.service';
import { PermissionEntity } from './entities/permission.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { RoleEntity } from './entities/role.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { UserEntity } from './entities/user.entity';

const userProfilesProtoPath = join(
  process.cwd(),
  'proto',
  'user.proto',
);
const protoIncludeDir = join(process.cwd(), 'proto');

@Module({
  imports: [
    ConfigurationModule,
    ClientsModule.registerAsync([
      {
        name: USER_PROFILES_GRPC_CLIENT,
        imports: [ConfigurationModule],
        inject: [ConfigurationService],
        useFactory: (configurationService: ConfigurationService) => ({
          options: {
            loader: {
              arrays: true,
              enums: String,
              includeDirs: [protoIncludeDir],
              keepCase: false,
              objects: true,
              oneofs: true,
            },
            package: 'user',
            protoPath: [userProfilesProtoPath],
            url: configurationService.getUserServiceConfig().grpcUrl,
          },
          transport: Transport.GRPC,
        }),
      },
    ]),
    TypeOrmModule.forFeature([
      UserEntity,
      RoleEntity,
      PermissionEntity,
      UserRoleEntity,
      RolePermissionEntity,
    ]),
  ],
  providers: [UserProfilesGrpcService],
  exports: [TypeOrmModule, UserProfilesGrpcService],
})
export class IdentityModule {}

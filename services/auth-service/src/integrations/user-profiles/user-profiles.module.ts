import { ConfigurationModule } from '@/configuration/configuration.module';
import { ConfigurationService } from '@/configuration/configuration.service';
import { USER_PROFILE_CLIENT } from '@/domain/ports/user-profile-client.port';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'node:path';
import {
  USER_PROFILES_GRPC_CLIENT,
  UserProfilesGrpcService,
} from './user-profiles-grpc.service';

const userProfilesProtoPath = join(process.cwd(), 'proto', 'user.proto');
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
  ],
  providers: [
    UserProfilesGrpcService,
    {
      provide: USER_PROFILE_CLIENT,
      useExisting: UserProfilesGrpcService,
    },
  ],
  exports: [USER_PROFILE_CLIENT, UserProfilesGrpcService],
})
export class UserProfilesModule {}

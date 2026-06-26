import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'node:path';
import { RedisModule } from '../../infrastructure/cache/redis.module';
import { AUTH_GRPC_CLIENT, AuthGrpcService } from './auth-grpc.service';
import { AuthHttpClient } from './auth-http.client';

const protoDir = join(process.cwd(), 'proto');

@Module({
  imports: [
    RedisModule,
    ClientsModule.register([
      {
        name: AUTH_GRPC_CLIENT,
        options: {
          loader: {
            arrays: true,
            enums: String,
            includeDirs: [protoDir],
            keepCase: false,
            objects: true,
            oneofs: true,
          },
          package: 'auth',
          protoPath: [join(protoDir, 'auth.proto')],
          url: process.env.AUTH_SERVICE_GRPC_URL ?? 'auth-service:50051',
        },
        transport: Transport.GRPC,
      },
    ]),
  ],
  providers: [AuthGrpcService, AuthHttpClient],
  exports: [AuthGrpcService, AuthHttpClient],
})
export class AuthModule {}

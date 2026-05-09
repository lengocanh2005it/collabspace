import { Module } from '@nestjs/common';
import { ConfigurationModule } from '@/configuration/configuration.module';
import { DatabaseModule } from '@/modules/database/database.module';
import { EmailsModule } from '@/modules/emails/emails.module';
import { GraphileWorkerModule } from '@/modules/graphile-worker/graphile-worker.module';
import { IdentityModule } from '@/modules/identity/identity.module';
import { RabbitMqModule } from '@/modules/rabbitmq/rabbitmq.module';
import { RefreshTokensModule } from '@/modules/refresh-tokens/refresh-tokens.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { AuthGrpcController } from './auth.grpc.controller';
import { AuthController } from './app.controller';
import { AuthService } from './app.service';

@Module({
  imports: [
    ConfigurationModule,
    DatabaseModule,
    EmailsModule,
    GraphileWorkerModule,
    IdentityModule,
    RabbitMqModule,
    RefreshTokensModule,
    RedisModule,
  ],
  controllers: [AuthController, AuthGrpcController],
  providers: [AuthService],
})
export class AppModule {}

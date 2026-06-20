import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

import { ConfigurationModule } from './configuration/configuration.module';
import { ConfigurationService } from './configuration/configuration.service';
import { MetricsModule } from './metrics/metrics.module';
import { AuthModule } from './integrations/auth/auth.module';
import { platformAdminAuthProviders } from './integrations/auth/platform-admin-auth.providers';

import { DlqRecord, DlqRecordSchema } from './domain/dlq-record.schema';
import { DlqHealthService } from './health/dlq-health.service';
import { HealthController } from './presentation/controllers/health.controller';
import { MetricsController } from './presentation/controllers/metrics.controller';

@Module({
  imports: [
    ConfigurationModule,
    MetricsModule,
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      inject: [ConfigurationService],
      useFactory: (config: ConfigurationService) => ({
        uri: config.getMongoConfig().uri,
      }),
    }),
    MongooseModule.forFeature([{ name: DlqRecord.name, schema: DlqRecordSchema }]),
  ],
  controllers: [HealthController, MetricsController],
  providers: [DlqHealthService, ...platformAdminAuthProviders],
})
export class AppModule {}

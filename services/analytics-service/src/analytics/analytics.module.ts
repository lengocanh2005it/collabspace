import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './controllers/analytics.controller.js';
import { AnalyticsHealthService } from '../health/analytics-health.service.js';
import { AnalyticsRepository } from './repositories/analytics.repository.js';
import { AnalyticsService } from './services/analytics.service.js';
import { AuthModule } from '../integrations/auth/auth.module.js';
import { platformAdminAuthProviders } from '../integrations/auth/platform-admin-auth.providers.js';
import { PlatformSnapshot, PlatformSnapshotSchema } from '../domain/platform-snapshot.schema.js';
import { TimeseriesDaily, TimeseriesDailySchema } from '../domain/timeseries-daily.schema.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: PlatformSnapshot.name, schema: PlatformSnapshotSchema },
      { name: TimeseriesDaily.name, schema: TimeseriesDailySchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsHealthService,
    AnalyticsRepository,
    AnalyticsService,
    ...platformAdminAuthProviders,
  ],
  exports: [AnalyticsHealthService, AnalyticsRepository],
})
export class AnalyticsModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './controllers/analytics.controller.js';
import { AnalyticsHealthService } from '../health/analytics-health.service.js';
import { PlatformSnapshot, PlatformSnapshotSchema } from '../domain/platform-snapshot.schema.js';
import { TimeseriesDaily, TimeseriesDailySchema } from '../domain/timeseries-daily.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PlatformSnapshot.name, schema: PlatformSnapshotSchema },
      { name: TimeseriesDaily.name, schema: TimeseriesDailySchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsHealthService],
  exports: [AnalyticsHealthService],
})
export class AnalyticsModule {}

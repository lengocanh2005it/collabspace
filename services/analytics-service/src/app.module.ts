import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigurationModule } from './config/configuration.module.js';
import { ConfigurationService } from './config/configuration.service.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ConfigurationModule,
    MetricsModule,
    MongooseModule.forRootAsync({
      inject: [ConfigurationService],
      useFactory: (config: ConfigurationService) => ({
        uri: config.getMongoConfig().uri,
      }),
    }),
    AnalyticsModule,
  ],
})
export class AppModule {}

import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service.js';

@Global()
@Module({
  providers: [
    {
      provide: MetricsService,
      useFactory: () => new MetricsService('analytics-service'),
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}

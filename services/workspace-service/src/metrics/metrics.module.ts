import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  providers: [
    {
      provide: MetricsService,
      useFactory: () => new MetricsService('workspace-service'),
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}

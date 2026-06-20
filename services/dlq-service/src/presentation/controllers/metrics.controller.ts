import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { assertMetricsAccess } from '../../metrics/metrics-access';
import { MetricsService } from '../../metrics/metrics.service';

@ApiExcludeController()
@Controller('dlq')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  async getMetrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    assertMetricsAccess(req);
    const metrics = await this.metricsService.getRegistry().metrics();
    res.set('Content-Type', this.metricsService.getRegistry().contentType);
    res.end(metrics);
  }
}

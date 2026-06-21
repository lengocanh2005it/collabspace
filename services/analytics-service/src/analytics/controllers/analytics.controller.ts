import { Controller, Get, HttpCode, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AnalyticsHealthService } from '../../health/analytics-health.service.js';
import { assertMetricsAccess } from '../../metrics/metrics-access.js';
import { MetricsService } from '../../metrics/metrics.service.js';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly healthService: AnalyticsHealthService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get('health/live')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness probe' })
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness probe' })
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const report = await this.healthService.getReadiness();

    response.status(report.ready ? 200 : 503);

    return report;
  }

  @Get('metrics')
  async getMetrics(@Req() request: Request, @Res() response: Response) {
    assertMetricsAccess(request);
    const metrics = await this.metricsService.getMetrics();

    response.set('Content-Type', this.metricsService.contentType);
    response.send(metrics);
  }
}

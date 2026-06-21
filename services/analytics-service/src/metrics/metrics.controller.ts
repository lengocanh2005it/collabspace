import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { assertMetricsAccess } from './metrics-access.js';
import { MetricsService } from './metrics.service.js';

@ApiTags('metrics')
@Controller('analytics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  async getMetrics(@Req() request: Request, @Res() response: Response) {
    assertMetricsAccess(request);
    const metrics = await this.metricsService.getMetrics();
    response.set('Content-Type', this.metricsService.contentType);
    response.send(metrics);
  }
}

import { Controller, Get, HttpCode, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { WorkspaceHealthService } from '../../health/workspace-health.service';
import { assertMetricsAccess } from '../../metrics/metrics-access';
import { MetricsService } from '../../metrics/metrics.service';

@Controller('workspaces')
export class HealthController {
  constructor(
    private readonly workspaceHealthService: WorkspaceHealthService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get('health')
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const report = await this.workspaceHealthService.getReadiness();
    response.status(report.ready ? 200 : 503);
    return report;
  }

  @Get('health/live')
  @HttpCode(200)
  getLiveness() {
    return this.workspaceHealthService.getLiveness();
  }

  @Get('health/ready')
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const report = await this.workspaceHealthService.getReadiness();
    response.status(report.ready ? 200 : 503);
    return report;
  }

  @Get('metrics')
  async getMetrics(@Req() request: Request, @Res() response: Response) {
    assertMetricsAccess(request);
    response.set('Content-Type', this.metricsService.contentType);
    response.send(await this.metricsService.getMetrics());
  }
}

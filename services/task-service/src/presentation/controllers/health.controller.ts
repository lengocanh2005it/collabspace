import { Controller, Get, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { TaskHealthService } from "../../health/task-health.service";
import { assertMetricsAccess } from "../../metrics/metrics-access";
import { MetricsService } from "../../metrics/metrics.service";

@Controller("v1/tasks")
export class HealthController {
  constructor(
    private readonly taskHealthService: TaskHealthService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get("health")
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const report = await this.taskHealthService.getReadiness();
    response.status(report.ready ? 200 : 503);
    return report;
  }

  @Get("health/live")
  @HttpCode(200)
  getLiveness() {
    return this.taskHealthService.getLiveness();
  }

  @Get("health/ready")
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const report = await this.taskHealthService.getReadiness();
    response.status(report.ready ? 200 : 503);
    return report;
  }

  @Get("metrics")
  async getMetrics(@Req() request: Request, @Res() response: Response) {
    assertMetricsAccess(request);
    response.set("Content-Type", this.metricsService.contentType);
    response.send(await this.metricsService.getMetrics());
  }
}

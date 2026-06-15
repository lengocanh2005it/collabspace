import { Controller, Get, HttpCode, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import type { TaskHealthService } from "../../health/task-health.service";
import { assertMetricsAccess } from "../../metrics/metrics-access";
import type { MetricsService } from "../../metrics/metrics.service";

@ApiTags("health")
@Controller("tasks")
export class HealthController {
  constructor(
    private readonly taskHealthService: TaskHealthService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Health summary (readiness)" })
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const report = await this.taskHealthService.getReadiness();
    response.status(report.ready ? 200 : 503);
    return report;
  }

  @Get("health/live")
  @HttpCode(200)
  @ApiOperation({ summary: "Liveness probe" })
  getLiveness() {
    return this.taskHealthService.getLiveness();
  }

  @Get("health/ready")
  @ApiOperation({ summary: "Readiness probe" })
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

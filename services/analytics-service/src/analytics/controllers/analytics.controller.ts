import { Controller, Get, HttpCode, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PlatformAdminGuard, RequirePlatformAdmin } from '@collabspace/nest-auth';
import { AnalyticsHealthService } from '../../health/analytics-health.service.js';
import { assertMetricsAccess } from '../../metrics/metrics-access.js';
import { MetricsService } from '../../metrics/metrics.service.js';
import { AnalyticsService } from '../services/analytics.service.js';
import {
  PlatformOverviewResponseDto,
  UserMetricsDto,
  WorkspaceMetricsDto,
  TaskMetricsDto,
} from '../dto/platform-overview.dto.js';
import { TimeseriesQueryDto, TimeseriesResponseDto } from '../dto/timeseries-query.dto.js';

@ApiTags('analytics')
@ApiBearerAuth()
@RequirePlatformAdmin()
@UseGuards(PlatformAdminGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly healthService: AnalyticsHealthService,
    private readonly metricsService: MetricsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Platform overview — all metrics snapshot' })
  @ApiOkResponse({ type: PlatformOverviewResponseDto })
  async getOverview(): Promise<PlatformOverviewResponseDto> {
    return this.analyticsService.getOverview();
  }

  @Get('users')
  @ApiOperation({ summary: 'User metrics' })
  @ApiOkResponse({ type: UserMetricsDto })
  async getUsers(): Promise<UserMetricsDto> {
    return this.analyticsService.getUsers();
  }

  @Get('workspaces')
  @ApiOperation({ summary: 'Workspace metrics' })
  @ApiOkResponse({ type: WorkspaceMetricsDto })
  async getWorkspaces(): Promise<WorkspaceMetricsDto> {
    return this.analyticsService.getWorkspaces();
  }

  @Get('tasks')
  @ApiOperation({ summary: 'Task metrics' })
  @ApiOkResponse({ type: TaskMetricsDto })
  async getTasks(): Promise<TaskMetricsDto> {
    return this.analyticsService.getTasks();
  }

  @Get('activity')
  @ApiOperation({ summary: 'Timeseries activity data' })
  @ApiOkResponse({ type: TimeseriesResponseDto })
  @ApiQuery({
    name: 'metric',
    required: false,
    enum: ['users_registered', 'workspaces_created', 'tasks_created', 'tasks_completed'],
  })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'interval', required: false, enum: ['day'] })
  async getActivity(@Query() query: TimeseriesQueryDto): Promise<TimeseriesResponseDto> {
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    return this.analyticsService.getActivity(
      query.metric,
      query.from ?? thirtyDaysAgo,
      query.to ?? today,
      query.interval,
    );
  }

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

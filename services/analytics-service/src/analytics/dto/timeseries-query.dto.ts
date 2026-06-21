import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import type { TimeseriesMetric } from '../../domain/timeseries-daily.schema.js';

const VALID_METRICS: TimeseriesMetric[] = [
  'users_registered',
  'workspaces_created',
  'tasks_created',
  'tasks_completed',
];

export class TimeseriesQueryDto {
  @ApiPropertyOptional({
    enum: VALID_METRICS,
    default: 'tasks_created',
    description: 'Metric to query',
  })
  @IsOptional()
  @IsIn(VALID_METRICS)
  metric: TimeseriesMetric = 'tasks_created';

  @ApiPropertyOptional({ description: 'Start date ISO 8601 (default: 30 days ago)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'End date ISO 8601 (default: today)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: ['day'], default: 'day' })
  @IsOptional()
  @IsIn(['day'])
  interval: 'day' = 'day';
}

export class TimeseriesDataPointDto {
  @ApiPropertyOptional() date!: string;
  @ApiPropertyOptional() value!: number;
}

export class TimeseriesResponseDto {
  @ApiPropertyOptional() metric!: string;
  @ApiPropertyOptional() interval!: string;
  @ApiPropertyOptional() from!: string;
  @ApiPropertyOptional() to!: string;
  @ApiPropertyOptional({ type: [TimeseriesDataPointDto] }) data!: TimeseriesDataPointDto[];
}

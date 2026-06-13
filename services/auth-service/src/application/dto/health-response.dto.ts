import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HealthCheckResultDto {
  @ApiPropertyOptional()
  detail?: string;

  @ApiProperty()
  required: boolean;

  @ApiPropertyOptional()
  responseTimeMs?: number;

  @ApiProperty({ enum: ['up', 'down', 'disabled'] })
  status: 'up' | 'down' | 'disabled';
}

export class LivenessReportDto {
  @ApiProperty({ example: 'auth-service' })
  service: string;

  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status: 'ok';

  @ApiProperty({ format: 'date-time' })
  timestamp: string;

  @ApiProperty({ example: 42 })
  uptimeSeconds: number;
}

export class ReadinessReportDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  checks: Record<string, HealthCheckResultDto>;

  @ApiProperty({ enum: ['full', 'degraded'] })
  mode: 'full' | 'degraded';

  @ApiProperty()
  ready: boolean;

  @ApiProperty({ example: 'auth-service' })
  service: string;

  @ApiProperty({ enum: ['ok', 'degraded', 'error'] })
  status: 'ok' | 'degraded' | 'error';

  @ApiProperty({ format: 'date-time' })
  timestamp: string;
}

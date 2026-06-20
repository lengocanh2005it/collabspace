import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DlqHealthService } from '../../health/dlq-health.service';

@ApiTags('health')
@Controller('dlq')
export class HealthController {
  constructor(private readonly healthService: DlqHealthService) {}

  @Get('health/live')
  @HttpCode(HttpStatus.OK)
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('health/ready')
  async getReadiness(@Res() res: Response) {
    const report = await this.healthService.getReadiness();
    res.status(report.ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(report);
  }
}

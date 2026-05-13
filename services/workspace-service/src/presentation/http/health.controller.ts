import { Controller, Get, HttpCode } from '@nestjs/common';

@Controller('workspaces')
export class HealthController {
  @Get('health')
  @HttpCode(200)
  healthCheck() {
    return {
      service: 'workspace-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

import { Controller, Get, Patch, Req, UnauthorizedException, HttpCode } from '@nestjs/common';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { GetNotificationsQuery } from '../../../application/usecases/get-notifications/get-notifications.query';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('health')
  @HttpCode(200)
  getHealth() {
    return { service: 'notification-service', status: 'ok' };
  }

  private extractUserId(req: any): string {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in request');
    }
    return userId;
  }

  @Get()
  async getNotifications(@Req() req: any) {
    const userId = this.extractUserId(req);
    // Hardcoded pagination for now, can be extracted from query params later
    return this.queryBus.execute(
      new GetNotificationsQuery(userId, 0, 50),
    );
  }

  @Patch('read-all')
  async markAllRead(@Req() req: any) {
    const userId = this.extractUserId(req);
    return { success: true };
  }
}

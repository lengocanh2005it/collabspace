import {
  Controller,
  Get,
  Patch,
  Param,
  HttpCode,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import {
  GetNotificationsResponseSchemaDto,
  MarkAllNotificationsReadResponseSchemaDto,
  MessageResponseSchemaDto,
} from "../dtos/notification-swagger-response.dto";
import type { Request, Response } from "express";
import { CommandBus, QueryBus } from "@nestjs/cqrs";

import { GetNotificationsQuery } from "../../application/usecases/get-notifications/get-notifications.query";
import { MarkNotificationReadCommand } from "../../application/usecases/mark-notification-read/mark-notification-read.command";
import { MarkNotificationArchiveCommand } from "../../application/usecases/mark-notification-archive/mark-notification-archive.command";
import { MarkAllNotificationsReadCommand } from "../../application/usecases/mark-all-notifications-read/mark-all-notifications-read.command";

import { NotificationHealthService } from "../../health/notification-health.service";
import { assertMetricsAccess } from "../../metrics/metrics-access";
import { MetricsService } from "../../metrics/metrics.service";
import { AuthGuard } from "../guards/auth.guard";
import type { AuthenticatedRequest } from "../http/authenticated-request";
import { NotificationRealtimeService } from "../../application/services/notification-realtime.service";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly notificationHealthService: NotificationHealthService,
    private readonly metricsService: MetricsService,
    private readonly notificationRealtime: NotificationRealtimeService,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Health summary (readiness)" })
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const report = await this.notificationHealthService.getReadiness();

    response.status(report.ready ? 200 : 503);

    return report;
  }

  @Get("health/live")
  @HttpCode(200)
  @ApiOperation({ summary: "Liveness probe" })
  getLiveness() {
    return this.notificationHealthService.getLiveness();
  }

  @Get("health/ready")
  @ApiOperation({ summary: "Readiness probe" })
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const report = await this.notificationHealthService.getReadiness();

    response.status(report.ready ? 200 : 503);

    return report;
  }

  @Get("metrics")
  async getMetrics(@Req() request: Request, @Res() response: Response) {
    assertMetricsAccess(request);

    response.set("Content-Type", this.metricsService.contentType);
    response.send(await this.metricsService.getMetrics());
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List notifications for current user" })
  @ApiQuery({ name: "skip", required: false, type: Number, example: 0 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["active", "archived"],
    description: "Filter by archive state (default: active)",
  })
  @ApiOkResponse({ type: GetNotificationsResponseSchemaDto })
  async listNotifications(
    @Req() req: AuthenticatedRequest,
    @Query("skip") skip?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
  ) {
    const parsedSkip = Math.max(0, parseInt(skip ?? "0", 10) || 0);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit ?? "20", 10) || 20));
    const parsedStatus = status === "archived" ? "archived" : "active";
    return this.queryBus.execute(
      new GetNotificationsQuery(req.user.id, parsedSkip, parsedLimit, parsedStatus),
    );
  }

  @Get("stream")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Stream realtime notification invalidation events for current user" })
  streamNotifications(@Req() req: AuthenticatedRequest, @Res() response: Response): void {
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();

    const cleanup = this.notificationRealtime.addConnection(req.user.id, {
      close: () => {
        if (!response.writableEnded) {
          response.end();
        }
      },
      sendEvent: (event, payload) => {
        if (response.writableEnded) return;
        response.write(`event: ${event}\n`);
        response.write(`data: ${JSON.stringify(payload)}\n\n`);
      },
    });

    const keepalive = setInterval(() => {
      response.write(": keepalive\n\n");
    }, 25_000);
    keepalive.unref();

    const teardown = () => {
      clearInterval(keepalive);
      cleanup();
    };

    req.on("close", teardown);
    req.on("aborted", teardown);
    response.on("close", teardown);
    response.on("finish", teardown);
  }

  @Patch("read-all")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mark all notifications as read" })
  @ApiOkResponse({ type: MarkAllNotificationsReadResponseSchemaDto })
  async markAllAsRead(@Req() req: AuthenticatedRequest) {
    return this.commandBus.execute(new MarkAllNotificationsReadCommand(req.user.id));
  }

  @Patch(":id/archive")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Archive one notification" })
  @ApiParam({ name: "id", description: "Notification id" })
  @ApiOkResponse({ type: MessageResponseSchemaDto })
  async archive(@Param("id") notificationId: string, @Req() req: AuthenticatedRequest) {
    await this.commandBus.execute(new MarkNotificationArchiveCommand(notificationId, req.user.id));

    return { message: "Notification archived" };
  }

  @Patch(":id/read")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mark one notification as read" })
  @ApiParam({ name: "id", description: "Notification id" })
  @ApiOkResponse({ type: MessageResponseSchemaDto })
  async markAsRead(@Param("id") notificationId: string, @Req() req: AuthenticatedRequest) {
    await this.commandBus.execute(new MarkNotificationReadCommand(notificationId, req.user.id));

    return { message: "Notification marked as read" };
  }
}

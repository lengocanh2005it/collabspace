import {

  Controller,

  Get,

  Headers,

  HttpCode,

  Query,

  Res,

  UnauthorizedException,

} from "@nestjs/common";

import type { Response } from "express";

import { QueryBus } from "@nestjs/cqrs";

import { GetNotificationsQuery } from "../../application/usecases/get-notifications/get-notifications.query";

import { NotificationHealthService } from "../../health/notification-health.service";
import { MetricsService } from "../../metrics/metrics.service";



@Controller("v1/notifications")

export class NotificationsController {

  constructor(

    private readonly queryBus: QueryBus,

    private readonly notificationHealthService: NotificationHealthService,

    private readonly metricsService: MetricsService,

  ) {}



  @Get("health")

  async getHealth(@Res({ passthrough: true }) response: Response) {

    const report = await this.notificationHealthService.getReadiness();

    response.status(report.ready ? 200 : 503);

    return report;

  }



  @Get("health/live")

  @HttpCode(200)

  getLiveness() {

    return this.notificationHealthService.getLiveness();

  }



  @Get("health/ready")

  async getReadiness(@Res({ passthrough: true }) response: Response) {

    const report = await this.notificationHealthService.getReadiness();

    response.status(report.ready ? 200 : 503);

    return report;

  }



  @Get("metrics")

  async getMetrics(@Res() response: Response) {

    response.set("Content-Type", this.metricsService.contentType);

    response.send(await this.metricsService.getMetrics());

  }



  @Get()

  async listNotifications(

    @Headers("x-user-id") userIdHeader: string | undefined,

    @Query("skip") skip?: string,

    @Query("limit") limit?: string,

  ) {

    const recipientId = userIdHeader?.trim();



    if (!recipientId) {

      throw new UnauthorizedException({

        code: "TOKEN_MISSING",

        message: "X-User-Id header is required",

      });

    }



    return this.queryBus.execute(

      new GetNotificationsQuery(

        recipientId,

        Number(skip ?? 0),

        Number(limit ?? 20),

      ),

    );

  }

}



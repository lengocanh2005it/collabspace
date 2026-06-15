import { BadRequestException, Body, Controller, Headers, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { AdminUserId, PlatformAdminGuard, RequirePlatformAdmin } from "@collabspace/nest-auth";
import { BroadcastJobService } from "../../application/services/broadcast-job.service";
import type { BroadcastNotificationDto } from "../dtos/broadcast-notification.dto";

@ApiTags("notifications-admin")
@ApiBearerAuth()
@RequirePlatformAdmin()
@UseGuards(PlatformAdminGuard)
@Controller("notifications/admin")
export class NotificationAdminController {
  constructor(private readonly broadcastJobs: BroadcastJobService) {}

  @Post("broadcast")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  async broadcast(
    @Body() body: BroadcastNotificationDto,
    @AdminUserId() actorId: string,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "Idempotency-Key header is required",
      });
    }
    return this.broadcastJobs.enqueue({
      actorId,
      body: body.body,
      idempotencyKey: idempotencyKey.trim(),
      title: body.title,
    });
  }
}

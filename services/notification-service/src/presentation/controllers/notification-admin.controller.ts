import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { isPlatformAdmin } from "@collabspace/shared";
import { BroadcastJobService } from "../../application/services/broadcast-job.service";
import { AuthGrpcService } from "../../integrations/auth/auth-grpc.service";
import { BroadcastNotificationDto } from "../dtos/broadcast-notification.dto";

@ApiTags("notifications-admin")
@ApiBearerAuth()
@Controller("notifications/admin")
export class NotificationAdminController {
  constructor(
    private readonly authService: AuthGrpcService,
    private readonly broadcastJobs: BroadcastJobService,
  ) {}

  @Post("broadcast")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  async broadcast(
    @Body() body: BroadcastNotificationDto,
    @Headers("authorization") authorization?: string,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    const identity = await this.authService.verifyAccessToken(authorization);
    if (!isPlatformAdmin(identity)) {
      throw new ForbiddenException({
        code: "PLATFORM_ADMIN_REQUIRED",
        message: "Platform administrator role is required",
      });
    }
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "Idempotency-Key header is required",
      });
    }
    return this.broadcastJobs.enqueue({
      actorId: identity.userId,
      body: body.body,
      idempotencyKey: idempotencyKey.trim(),
      title: body.title,
    });
  }
}

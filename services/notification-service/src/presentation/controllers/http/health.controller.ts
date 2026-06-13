import { Controller, Get, HttpCode } from "@nestjs/common";

@Controller("notifications")
export class HealthController {
  @Get("health")
  @HttpCode(200)
  getHealth() {
    return { service: "notification-service", status: "ok" };
  }
}

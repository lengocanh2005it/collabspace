import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import request from "supertest";
import { NotificationsController } from "../src/presentation/controllers/notifications.controller";
import { AuthGuard } from "../src/presentation/guards/auth.guard";
import { NotificationHealthService } from "../src/health/notification-health.service";
import { MetricsService } from "../src/metrics/metrics.service";

describe("notification-service HTTP (e2e)", () => {
  let app: INestApplication;
  const commandBus = { execute: jest.fn() };
  const queryBus = { execute: jest.fn() };

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
        {
          provide: NotificationHealthService,
          useValue: {
            getLiveness: () => ({ status: "ok" }),
            getReadiness: () => ({ ready: true, status: "ok" }),
          },
        },
        {
          provide: MetricsService,
          useValue: { contentType: "text/plain", getMetrics: jest.fn() },
        },
      ],
    });
    const module = await builder
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: any) => {
          context.switchToHttp().getRequest().user = { id: "user-1" };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  it("lists notifications for the authenticated user", async () => {
    queryBus.execute.mockResolvedValue({ items: [], total: 0 });
    await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", "Bearer test")
      .expect(200);
    expect(queryBus.execute).toHaveBeenCalled();
  });

  it("marks all notifications read", async () => {
    commandBus.execute.mockResolvedValue({ updatedCount: 2 });
    await request(app.getHttpServer())
      .patch("/api/v1/notifications/read-all")
      .set("Authorization", "Bearer test")
      .expect(200)
      .expect({ updatedCount: 2 });
  });

  afterAll(async () => app?.close());
});

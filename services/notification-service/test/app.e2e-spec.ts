import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import request from "supertest";
import { NotificationsController } from "../src/presentation/controllers/notifications.controller";
import { NotificationAdminController } from "../src/presentation/controllers/notification-admin.controller";
import { AuthGuard } from "../src/presentation/guards/auth.guard";
import { PlatformAdminGuard } from "@collabspace/nest-auth";
import { NotificationHealthService } from "../src/health/notification-health.service";
import { MetricsService } from "../src/metrics/metrics.service";
import { BroadcastJobService } from "../src/application/services/broadcast-job.service";
import { NotificationRealtimeService } from "../src/application/services/notification-realtime.service";

const MOCK_USER = { id: "user-1" };
const NOTIFICATION_ID = "notif-abc";

const authGuard = {
  canActivate: (ctx: any) => {
    ctx.switchToHttp().getRequest().user = MOCK_USER;
    return true;
  },
};
const platformAdminGuard = {
  canActivate: (ctx: any) => {
    const req = ctx.switchToHttp().getRequest();
    req.user = { id: "admin-1", isPlatformAdmin: true };
    // @AdminUserId() reads request.adminIdentity.userId
    req.adminIdentity = { userId: "admin-1" };
    return true;
  },
};

describe("notification-service HTTP (e2e)", () => {
  let app: INestApplication;
  let commandBus: { execute: jest.Mock };
  let queryBus: { execute: jest.Mock };
  let broadcastJobs: { enqueue: jest.Mock };

  beforeEach(async () => {
    commandBus = { execute: jest.fn() };
    queryBus = { execute: jest.fn() };
    broadcastJobs = { enqueue: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [NotificationsController, NotificationAdminController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
        { provide: BroadcastJobService, useValue: broadcastJobs },
        {
          provide: NotificationRealtimeService,
          useValue: { notifyUser: jest.fn() },
        },
        {
          provide: NotificationHealthService,
          useValue: {
            getLiveness: () => ({ status: "ok" }),
            getReadiness: () => ({ ready: true, status: "ok" }),
          },
        },
        {
          provide: MetricsService,
          useValue: { contentType: "text/plain", getMetrics: jest.fn().mockResolvedValue("") },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(authGuard)
      .overrideGuard(PlatformAdminGuard)
      .useValue(platformAdminGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterEach(async () => app?.close());

  // ── Health ────────────────────────────────────────────────────────────────

  describe("GET /api/v1/notifications/health", () => {
    it("returns service name and status", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/notifications/health")
        .expect(200);

      expect(res.body).toMatchObject({ status: "ok" });
    });
  });

  describe("GET /api/v1/notifications/health/live", () => {
    it("returns liveness ok", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/notifications/health/live")
        .expect(200);

      expect(res.body).toMatchObject({ status: "ok" });
    });
  });

  describe("GET /api/v1/notifications/health/ready", () => {
    it("returns readiness ok", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/notifications/health/ready")
        .expect(200);

      expect(res.body).toMatchObject({ ready: true });
    });
  });

  // ── List notifications ────────────────────────────────────────────────────

  describe("GET /api/v1/notifications", () => {
    it("returns paginated notifications for authenticated user", async () => {
      queryBus.execute.mockResolvedValue({ items: [], total: 0 });

      const res = await request(app.getHttpServer())
        .get("/api/v1/notifications")
        .set("Authorization", "Bearer test")
        .expect(200);

      expect(res.body).toMatchObject(expect.objectContaining({ total: 0, items: [] }));
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: MOCK_USER.id }),
      );
    });

    it("passes skip, limit, and status filters to query bus", async () => {
      queryBus.execute.mockResolvedValue({ items: [], total: 0 });

      await request(app.getHttpServer())
        .get("/api/v1/notifications")
        .set("Authorization", "Bearer test")
        .query({ skip: "10", limit: "5", status: "archived" })
        .expect(200);

      // controller normalises: "archived" stays "archived", anything else → "active"
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, limit: 5, status: "archived" }),
      );
    });

    it("returns list of notification items", async () => {
      const mockItems = [
        {
          id: NOTIFICATION_ID,
          title: "Task assigned",
          status: "unread",
          createdAt: new Date().toISOString(),
        },
      ];
      queryBus.execute.mockResolvedValue({ items: mockItems, total: 1 });

      const res = await request(app.getHttpServer())
        .get("/api/v1/notifications")
        .set("Authorization", "Bearer test")
        .expect(200);

      expect(res.body).toMatchObject(expect.objectContaining({ total: 1 }));
    });
  });

  // ── Mark all read ─────────────────────────────────────────────────────────

  describe("PATCH /api/v1/notifications/read-all", () => {
    it("marks all notifications read and returns updatedCount", async () => {
      commandBus.execute.mockResolvedValue({ updatedCount: 5 });

      const res = await request(app.getHttpServer())
        .patch("/api/v1/notifications/read-all")
        .set("Authorization", "Bearer test")
        .expect(200);

      expect(res.body).toMatchObject(expect.objectContaining({ updatedCount: 5 }));
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: MOCK_USER.id }),
      );
    });

    it("returns updatedCount 0 when nothing to mark", async () => {
      commandBus.execute.mockResolvedValue({ updatedCount: 0 });

      const res = await request(app.getHttpServer())
        .patch("/api/v1/notifications/read-all")
        .set("Authorization", "Bearer test")
        .expect(200);

      expect(res.body).toMatchObject(expect.objectContaining({ updatedCount: 0 }));
    });
  });

  // ── Mark single read ──────────────────────────────────────────────────────

  describe("PATCH /api/v1/notifications/:id/read", () => {
    it("marks a single notification as read", async () => {
      commandBus.execute.mockResolvedValue({ id: NOTIFICATION_ID, status: "read" });

      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${NOTIFICATION_ID}/read`)
        .set("Authorization", "Bearer test")
        .expect(200);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ notificationId: NOTIFICATION_ID, recipientId: MOCK_USER.id }),
      );
    });
  });

  // ── Archive ───────────────────────────────────────────────────────────────

  describe("PATCH /api/v1/notifications/:id/archive", () => {
    it("archives a notification", async () => {
      commandBus.execute.mockResolvedValue({ id: NOTIFICATION_ID, status: "archived" });

      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${NOTIFICATION_ID}/archive`)
        .set("Authorization", "Bearer test")
        .expect(200);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ notificationId: NOTIFICATION_ID, recipientId: MOCK_USER.id }),
      );
    });
  });

  // ── Admin broadcast ───────────────────────────────────────────────────────

  describe("POST /api/v1/notifications/admin/broadcast", () => {
    it("enqueues a broadcast job", async () => {
      broadcastJobs.enqueue.mockResolvedValue({ jobId: "job-1", queued: true });

      const res = await request(app.getHttpServer())
        .post("/api/v1/notifications/admin/broadcast")
        .set("Authorization", "Bearer test")
        .set("Idempotency-Key", "broadcast-key-1")
        .send({ title: "System update", body: "Maintenance at midnight", target: "all" })
        .expect(201);

      expect(res.body).toMatchObject(expect.objectContaining({ jobId: "job-1" }));
      expect(broadcastJobs.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "System update",
          body: "Maintenance at midnight",
          idempotencyKey: "broadcast-key-1",
        }),
      );
    });

    it("returns 400 when Idempotency-Key header is missing", () =>
      request(app.getHttpServer())
        .post("/api/v1/notifications/admin/broadcast")
        .set("Authorization", "Bearer test")
        .send({ title: "Update", body: "Details", target: "all" })
        .expect(400));

    it("returns 400 when title is missing", () =>
      request(app.getHttpServer())
        .post("/api/v1/notifications/admin/broadcast")
        .set("Authorization", "Bearer test")
        .set("Idempotency-Key", "key-x")
        .send({ body: "No title", target: "all" })
        .expect(400));

    it("returns 400 when body is missing", () =>
      request(app.getHttpServer())
        .post("/api/v1/notifications/admin/broadcast")
        .set("Authorization", "Bearer test")
        .set("Idempotency-Key", "key-y")
        .send({ title: "Title only", target: "all" })
        .expect(400));
  });
});

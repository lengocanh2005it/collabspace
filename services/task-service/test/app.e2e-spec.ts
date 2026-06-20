import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import request from "supertest";
import { TaskController } from "../src/presentation/controllers/task.controller";
import { TaskCommentController } from "../src/presentation/controllers/task-comment.controller";
import { AuthGuard } from "../src/presentation/guards/auth.guard";
import { WorkspaceValidationGuard } from "../src/presentation/guards/workspace-validation.guard";
import { IdempotencyService } from "../src/infrastructure/idempotency/idempotency.service";

const MOCK_USER = { id: "user-1", name: "Alice" };
const WS_ID = "workspace-1";
const PROJ_ID = "project-1";
const TASK_ID = "task-abc-123";
const COMMENT_ID = "comment-xyz-456";

const authGuard = {
  canActivate: (ctx: any) => {
    ctx.switchToHttp().getRequest().user = MOCK_USER;
    return true;
  },
};

describe("task-service HTTP (e2e)", () => {
  let app: INestApplication;
  let commandBus: { execute: jest.Mock };
  let queryBus: { execute: jest.Mock };
  let idempotency: { findCached: jest.Mock; store: jest.Mock };

  beforeEach(async () => {
    commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    queryBus = { execute: jest.fn().mockResolvedValue(undefined) };
    idempotency = {
      findCached: jest.fn().mockResolvedValue(null),
      store: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      controllers: [TaskController, TaskCommentController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
        { provide: IdempotencyService, useValue: idempotency },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(authGuard)
      .overrideGuard(WorkspaceValidationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterEach(async () => app?.close());

  // ── Health ────────────────────────────────────────────────────────────────

  it("GET /api/v1/tasks/health returns service status", () =>
    request(app.getHttpServer())
      .get("/api/v1/tasks/health")
      .expect(200)
      .expect({ service: "task-service", status: "ok" }));

  // ── Create task ───────────────────────────────────────────────────────────

  describe("POST /api/v1/tasks", () => {
    it("creates a task and returns id", async () => {
      // controller uses execute return value directly as taskId (string)
      commandBus.execute.mockResolvedValue(TASK_ID);

      const res = await request(app.getHttpServer())
        .post("/api/v1/tasks")
        .set("Authorization", "Bearer test")
        .send({ title: "Fix bug", workspaceId: WS_ID })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ id: TASK_ID, taskId: TASK_ID });
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Fix bug", workspaceId: WS_ID }),
      );
    });

    it("creates task with all optional fields", async () => {
      commandBus.execute.mockResolvedValue(TASK_ID);

      await request(app.getHttpServer())
        .post("/api/v1/tasks")
        .set("Authorization", "Bearer test")
        .send({
          title: "Detailed task",
          workspaceId: WS_ID,
          projectId: PROJ_ID,
          description: "Some description",
          priority: "high",
          dueDate: "2026-12-31T00:00:00.000Z",
          labels: ["bug", "frontend"],
        })
        .expect(201);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: "high",
          labels: ["bug", "frontend"],
          projectId: PROJ_ID,
        }),
      );
    });

    it("returns 400 when title is missing", () =>
      request(app.getHttpServer())
        .post("/api/v1/tasks")
        .set("Authorization", "Bearer test")
        .send({ workspaceId: WS_ID })
        .expect(400));

    it("returns 400 when workspaceId is missing", () =>
      request(app.getHttpServer())
        .post("/api/v1/tasks")
        .set("Authorization", "Bearer test")
        .send({ title: "No workspace" })
        .expect(400));

    it("returns cached response when Idempotency-Key already used", async () => {
      const cached = {
        body: { success: true, data: { id: "cached-id", taskId: "cached-id" }, meta: {} },
      };
      idempotency.findCached.mockResolvedValue(cached);

      const res = await request(app.getHttpServer())
        .post("/api/v1/tasks")
        .set("Authorization", "Bearer test")
        .set("Idempotency-Key", "key-already-used")
        .send({ title: "Duplicate", workspaceId: WS_ID })
        .expect(201);

      expect(res.body.data).toMatchObject({ id: "cached-id" });
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });

  // ── List tasks ────────────────────────────────────────────────────────────

  describe("GET /api/v1/tasks", () => {
    it("returns paginated task list", async () => {
      // GetTasksResponse takes (tasks, total, skip, limit)
      queryBus.execute.mockResolvedValue({ tasks: [], total: 0, skip: 0, limit: 20 });

      const res = await request(app.getHttpServer())
        .get("/api/v1/tasks")
        .set("Authorization", "Bearer test")
        .query({ workspaceId: WS_ID })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ total: 0, tasks: [] });
    });

    it("passes status and priority filters to query bus", async () => {
      queryBus.execute.mockResolvedValue({ tasks: [], total: 0, skip: 0, limit: 5 });

      await request(app.getHttpServer())
        .get("/api/v1/tasks")
        .set("Authorization", "Bearer test")
        .query({ workspaceId: WS_ID, status: "TODO", priority: "high", limit: "5" })
        .expect(200);

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: WS_ID, status: "TODO", priority: "high" }),
      );
    });
  });

  // ── Kanban board ──────────────────────────────────────────────────────────

  describe("GET /api/v1/tasks/board", () => {
    it("returns board grouped by status columns", async () => {
      const mockBoard = {
        workspaceId: WS_ID,
        columns: [
          { status: "TODO", tasks: [], count: 0 },
          { status: "DOING", tasks: [], count: 0 },
          { status: "DONE", tasks: [], count: 0 },
        ],
        total: 0,
      };
      queryBus.execute.mockResolvedValue(mockBoard);

      const res = await request(app.getHttpServer())
        .get("/api/v1/tasks/board")
        .set("Authorization", "Bearer test")
        .query({ workspaceId: WS_ID })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.columns).toHaveLength(3);
      expect(res.body.data.columns[0]).toMatchObject({ status: "TODO" });
    });
  });

  // ── Get single task ───────────────────────────────────────────────────────

  describe("GET /api/v1/tasks/:id", () => {
    it("returns task by id", async () => {
      const mockTask = { id: TASK_ID, title: "Fix bug", status: "TODO", workspaceId: WS_ID };
      queryBus.execute.mockResolvedValue(mockTask);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${TASK_ID}`)
        .set("Authorization", "Bearer test")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ id: TASK_ID, title: "Fix bug" });
    });
  });

  // ── Activity timeline ─────────────────────────────────────────────────────

  describe("GET /api/v1/tasks/:id/activity", () => {
    it("returns activity log", async () => {
      queryBus.execute.mockResolvedValue({ events: [], total: 0 });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${TASK_ID}/activity`)
        .set("Authorization", "Bearer test")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });

  // ── Update task details ───────────────────────────────────────────────────

  describe("PATCH /api/v1/tasks/:id/details", () => {
    it("updates title and returns success message", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${TASK_ID}/details`)
        .set("Authorization", "Bearer test")
        .send({ title: "Updated title" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: TASK_ID, title: "Updated title" }),
      );
    });
  });

  // ── Change task status ────────────────────────────────────────────────────

  describe("PATCH /api/v1/tasks/:id/status", () => {
    it.each([["TODO"], ["DOING"], ["DONE"]])("accepts valid status %s", async (status) => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${TASK_ID}/status`)
        .set("Authorization", "Bearer test")
        .send({ status })
        .expect(200);

      expect(res.body.success).toBe(true);
      // ChangeTaskStatusCommand field is newStatus
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ newStatus: status }),
      );
    });

    it("returns 400 for invalid status value", () =>
      request(app.getHttpServer())
        .patch(`/api/v1/tasks/${TASK_ID}/status`)
        .set("Authorization", "Bearer test")
        .send({ status: "INVALID" })
        .expect(400));
  });

  // ── Assign task ───────────────────────────────────────────────────────────

  describe("PATCH /api/v1/tasks/:id/assignee", () => {
    it("assigns task to another user", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${TASK_ID}/assignee`)
        .set("Authorization", "Bearer test")
        .send({ assigneeId: "user-2" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeId: "user-2", taskId: TASK_ID }),
      );
    });

    it("unassigns task when assigneeId is omitted", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${TASK_ID}/assignee`)
        .set("Authorization", "Bearer test")
        .send({})
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeId: null }),
      );
    });
  });

  // ── Delete task ───────────────────────────────────────────────────────────

  describe("DELETE /api/v1/tasks/:id", () => {
    it("deletes a task and returns success", async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${TASK_ID}`)
        .set("Authorization", "Bearer test")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({ taskId: TASK_ID }));
    });
  });

  // ── Comments ──────────────────────────────────────────────────────────────

  describe("POST /api/v1/tasks/:taskId/comments", () => {
    it("creates a plain comment", async () => {
      commandBus.execute.mockResolvedValue({ id: COMMENT_ID });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${TASK_ID}/comments`)
        .set("Authorization", "Bearer test")
        .send({ content: "Great work!", workspaceId: WS_ID })
        .expect(201);

      // comment controller returns { statusCode, data } not { success, data }
      expect(res.body.data).toMatchObject({ id: COMMENT_ID });
    });

    it("creates a comment with @mention", async () => {
      commandBus.execute.mockResolvedValue({ id: COMMENT_ID });

      await request(app.getHttpServer())
        .post(`/api/v1/tasks/${TASK_ID}/comments`)
        .set("Authorization", "Bearer test")
        .send({ content: "Hey @alice, please review.", workspaceId: WS_ID })
        .expect(201);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining("@alice") }),
      );
    });

    it("creates a threaded reply with parentId", async () => {
      commandBus.execute.mockResolvedValue({ id: "reply-1" });

      await request(app.getHttpServer())
        .post(`/api/v1/tasks/${TASK_ID}/comments`)
        .set("Authorization", "Bearer test")
        .send({ content: "Agreed!", parentId: COMMENT_ID, workspaceId: WS_ID })
        .expect(201);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: COMMENT_ID }),
      );
    });

    it("returns 400 when content is missing", () =>
      request(app.getHttpServer())
        .post(`/api/v1/tasks/${TASK_ID}/comments`)
        .set("Authorization", "Bearer test")
        .send({ workspaceId: WS_ID })
        .expect(400));
  });

  describe("GET /api/v1/tasks/:taskId/comments", () => {
    it("returns paginated comment list", async () => {
      // GetTaskCommentsQuery result structure
      queryBus.execute.mockResolvedValue({ comments: [], total: 0 });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${TASK_ID}/comments`)
        .set("Authorization", "Bearer test")
        .query({ workspaceId: WS_ID })
        .expect(200);

      // comment controller returns { statusCode, data }
      expect(res.body.statusCode).toBe(200);
    });
  });

  describe("PATCH /api/v1/tasks/:taskId/comments/:commentId", () => {
    it("edits comment content", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${TASK_ID}/comments/${COMMENT_ID}`)
        .set("Authorization", "Bearer test")
        .send({ content: "Updated content", workspaceId: WS_ID })
        .expect(200);

      // EditCommentCommand uses newContent field
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ commentId: COMMENT_ID, newContent: "Updated content" }),
      );
    });
  });

  describe("DELETE /api/v1/tasks/:taskId/comments/:commentId", () => {
    it("deletes a comment", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${TASK_ID}/comments/${COMMENT_ID}`)
        .set("Authorization", "Bearer test")
        .query({ workspaceId: WS_ID })
        .expect(200);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ commentId: COMMENT_ID }),
      );
    });
  });
});

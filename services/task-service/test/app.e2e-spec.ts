import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import request from "supertest";
import { TaskController } from "../src/presentation/controllers/task.controller";
import { AuthGuard } from "../src/presentation/guards/auth.guard";
import { WorkspaceValidationGuard } from "../src/presentation/guards/workspace-validation.guard";
import { IdempotencyService } from "../src/infrastructure/idempotency/idempotency.service";

describe("task-service HTTP (e2e)", () => {
  let app: INestApplication;
  const queryBus = { execute: jest.fn() };

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        { provide: CommandBus, useValue: { execute: jest.fn() } },
        { provide: QueryBus, useValue: queryBus },
        {
          provide: IdempotencyService,
          useValue: { findCached: jest.fn(), remember: jest.fn() },
        },
      ],
    });
    const authGuard = {
      canActivate: (context: any) => {
        context.switchToHttp().getRequest().user = {
          id: "user-1",
          name: "User One",
        };
        return true;
      },
    };
    const module = await builder
      .overrideGuard(AuthGuard)
      .useValue(authGuard)
      .overrideGuard(WorkspaceValidationGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  it("exposes health", () =>
    request(app.getHttpServer())
      .get("/api/v1/tasks/health")
      .expect(200)
      .expect({ service: "task-service", status: "ok" }));

  it("returns the workspace board", async () => {
    queryBus.execute.mockResolvedValue({
      workspaceId: "workspace-1",
      columns: [],
      total: 0,
    });
    await request(app.getHttpServer())
      .get("/api/v1/tasks/board?workspaceId=workspace-1")
      .set("Authorization", "Bearer test")
      .expect(200);
    expect(queryBus.execute).toHaveBeenCalled();
  });

  afterAll(async () => app?.close());
});

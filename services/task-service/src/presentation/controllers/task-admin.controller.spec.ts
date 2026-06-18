import { Test } from "@nestjs/testing";
import request from "supertest";
import { PLATFORM_IDENTITY_RESOLVER, PlatformAdminGuard } from "@collabspace/nest-auth";
import { CountTasksByWorkspaceAdminUseCase } from "../../application/usecases/count-tasks-by-workspace-admin.use-case";
import { GetPlatformTaskStatsAdminUseCase } from "../../application/usecases/get-platform-task-stats-admin.use-case";
import { TaskAdminController } from "./task-admin.controller";

describe("TaskAdminController (http)", () => {
  let app: Awaited<ReturnType<typeof createApp>>["app"];
  const workspaceCountsUseCase = {
    execute: jest.fn(),
  };
  const platformStatsUseCase = {
    execute: jest.fn(),
  };
  const identityResolver = {
    resolve: jest.fn(),
  };

  async function createApp() {
    const moduleRef = await Test.createTestingModule({
      controllers: [TaskAdminController],
      providers: [
        PlatformAdminGuard,
        { provide: CountTasksByWorkspaceAdminUseCase, useValue: workspaceCountsUseCase },
        { provide: GetPlatformTaskStatsAdminUseCase, useValue: platformStatsUseCase },
        { provide: PLATFORM_IDENTITY_RESOLVER, useValue: identityResolver },
      ],
    }).compile();
    const nestApp = moduleRef.createNestApplication();
    nestApp.setGlobalPrefix("api/v1");
    await nestApp.init();
    return { app: nestApp, moduleRef };
  }

  beforeAll(async () => {
    ({ app } = await createApp());
  });

  beforeEach(() => jest.clearAllMocks());

  it("rejects non-admin callers", async () => {
    identityResolver.resolve.mockResolvedValue({
      role: "user",
      roles: ["user"],
      userId: "user-1",
    });

    await request(app.getHttpServer())
      .get("/api/v1/tasks/admin/workspace-counts")
      .set("Authorization", "Bearer member")
      .expect(403);
  });

  it("returns workspace task counts for platform admins", async () => {
    identityResolver.resolve.mockResolvedValue({
      role: "admin",
      roles: ["admin"],
      userId: "admin-1",
    });
    workspaceCountsUseCase.execute.mockResolvedValue({ "workspace-1": 5, "workspace-2": 0 });

    await request(app.getHttpServer())
      .get("/api/v1/tasks/admin/workspace-counts")
      .set("Authorization", "Bearer admin")
      .expect(200)
      .expect({ "workspace-1": 5, "workspace-2": 0 });
  });

  it("returns platform task stats for platform admins", async () => {
    identityResolver.resolve.mockResolvedValue({
      role: "admin",
      roles: ["admin"],
      userId: "admin-1",
    });
    platformStatsUseCase.execute.mockResolvedValue({
      total: 12,
      byStatus: { TODO: 5, DOING: 4, DONE: 3 },
    });

    await request(app.getHttpServer())
      .get("/api/v1/tasks/admin/platform-stats")
      .set("Authorization", "Bearer admin")
      .expect(200)
      .expect({ total: 12, byStatus: { TODO: 5, DOING: 4, DONE: 3 } });
  });

  afterAll(async () => {
    await app?.close();
  });
});

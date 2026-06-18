import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PlatformAdminGuard, RequirePlatformAdmin } from "@collabspace/nest-auth";
import { CountTasksByWorkspaceAdminUseCase } from "../../application/usecases/count-tasks-by-workspace-admin.use-case";
import { GetPlatformTaskStatsAdminUseCase } from "../../application/usecases/get-platform-task-stats-admin.use-case";

@ApiTags("tasks-admin")
@ApiBearerAuth()
@RequirePlatformAdmin()
@UseGuards(PlatformAdminGuard)
@Controller("tasks/admin")
export class TaskAdminController {
  constructor(
    private readonly workspaceCountsUseCase: CountTasksByWorkspaceAdminUseCase,
    private readonly platformStatsUseCase: GetPlatformTaskStatsAdminUseCase,
  ) {}

  @Get("workspace-counts")
  @ApiOperation({
    summary: "Count tasks per workspace",
    description: "Returns a map of workspaceId → task count for platform admin dashboards.",
  })
  workspaceCounts() {
    return this.workspaceCountsUseCase.execute();
  }

  @Get("platform-stats")
  @ApiOperation({
    summary: "Platform-wide task totals and status breakdown",
    description:
      "Returns total tasks and counts grouped by TODO / DOING / DONE for admin overview.",
  })
  platformStats() {
    return this.platformStatsUseCase.execute();
  }
}

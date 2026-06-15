import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminUserId,
  PlatformAdminGuard,
  RequirePlatformAdmin,
} from '@collabspace/nest-auth';
import { ForceJoinWorkspaceDto } from '../../application/dto/workspace-admin.dto';
import { ManageWorkspacesAdminUseCase } from '../../application/use-cases/workspace/manage-workspaces-admin.use-case';

@ApiTags('workspaces-admin')
@ApiBearerAuth()
@RequirePlatformAdmin()
@UseGuards(PlatformAdminGuard)
@Controller('workspaces/admin')
export class WorkspaceAdminController {
  constructor(private readonly useCase: ManageWorkspacesAdminUseCase) {}

  @Get('all')
  list() {
    return this.useCase.list();
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Force-delete a workspace' })
  async forceDelete(
    @AdminUserId() actorId: string,
    @Param('id') workspaceId: string,
  ): Promise<void> {
    await this.useCase.forceDelete(actorId, workspaceId);
  }

  @Post(':id/force-join')
  @HttpCode(204)
  async forceJoin(
    @AdminUserId() actorId: string,
    @Param('id') workspaceId: string,
    @Body() body: ForceJoinWorkspaceDto,
  ): Promise<void> {
    await this.useCase.forceJoin(actorId, workspaceId, body.role, body.reason);
  }
}

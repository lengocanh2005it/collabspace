import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isPlatformAdmin } from '@collabspace/shared';
import { ForceJoinWorkspaceDto } from '../../application/dto/workspace-admin.dto';
import { ManageWorkspacesAdminUseCase } from '../../application/use-cases/workspace/manage-workspaces-admin.use-case';
import { AuthGrpcService } from '../../integrations/auth/auth-grpc.service';

@ApiTags('workspaces-admin')
@ApiBearerAuth()
@Controller('workspaces/admin')
export class WorkspaceAdminController {
  constructor(
    private readonly authService: AuthGrpcService,
    private readonly useCase: ManageWorkspacesAdminUseCase,
  ) {}

  @Get('all')
  list(@Headers('authorization') authorization?: string) {
    return this.withAdmin(authorization, () => this.useCase.list());
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Force-delete a workspace' })
  async forceDelete(
    @Param('id') workspaceId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<void> {
    await this.withAdmin(authorization, (identity) =>
      this.useCase.forceDelete(identity.userId, workspaceId),
    );
  }

  @Post(':id/force-join')
  @HttpCode(204)
  async forceJoin(
    @Param('id') workspaceId: string,
    @Body() body: ForceJoinWorkspaceDto,
    @Headers('authorization') authorization?: string,
  ): Promise<void> {
    await this.withAdmin(authorization, (identity) =>
      this.useCase.forceJoin(
        identity.userId,
        workspaceId,
        body.role,
        body.reason,
      ),
    );
  }

  private async withAdmin<T>(
    authorization: string | undefined,
    callback: (identity: {
      permissions?: string[];
      role?: string;
      roles?: string[];
      userId: string;
    }) => Promise<T> | T,
  ): Promise<T> {
    const identity = await this.authService.verifyAccessToken(authorization);
    if (!isPlatformAdmin(identity)) {
      throw new ForbiddenException({
        code: 'PLATFORM_ADMIN_REQUIRED',
        message: 'Platform administrator role is required',
      });
    }
    return callback(identity);
  }
}

import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiExcludeController,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CheckWorkspaceMembershipUseCase } from '../../application/use-cases/workspace/check-workspace-membership.use-case';
import { assertInternalServiceAccess } from './internal-service-access';

@ApiExcludeController()
@ApiTags('workspaces-internal')
@ApiSecurity('service-jwt')
@Controller('workspaces/internal')
export class InternalWorkspaceController {
  constructor(
    private readonly checkWorkspaceMembershipUseCase: CheckWorkspaceMembershipUseCase,
  ) {}

  @Get(':workspaceId/membership')
  @ApiOperation({
    summary: 'Check workspace membership (S2S)',
    description:
      'Requires Service JWT (workspace.membership.read, aud=workspace-service). Not exposed via Traefik.',
  })
  @ApiParam({ name: 'workspaceId', format: 'uuid' })
  @ApiQuery({ name: 'userId', format: 'uuid', required: true })
  async getMembership(
    @Req() request: Request,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query('userId', ParseUUIDPipe) userId: string,
  ) {
    assertInternalServiceAccess(request);
    return this.checkWorkspaceMembershipUseCase.execute(workspaceId, userId);
  }
}

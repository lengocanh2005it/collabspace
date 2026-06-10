import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CheckWorkspaceMembershipUseCase } from '../../application/use-cases/workspace/check-workspace-membership.use-case';
import { assertInternalServiceAccess } from './internal-service-access';

@Controller('workspaces/internal')
export class InternalWorkspaceController {
  constructor(
    private readonly checkWorkspaceMembershipUseCase: CheckWorkspaceMembershipUseCase,
  ) {}

  @Get(':workspaceId/membership')
  async getMembership(
    @Req() request: Request,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query('userId', ParseUUIDPipe) userId: string,
  ) {
    assertInternalServiceAccess(request);
    return this.checkWorkspaceMembershipUseCase.execute(workspaceId, userId);
  }
}

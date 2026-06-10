import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LookupUserReplicasUseCase } from '../../application/use-cases/lookup-user-replicas.use-case';
import { LookupUserReplicasRequestDto } from './dto/lookup-user-replicas-request.dto';
import { assertInternalServiceAccess } from './internal-service-access';

@Controller('users/internal')
export class InternalUsersController {
  constructor(
    private readonly lookupUserReplicasUseCase: LookupUserReplicasUseCase,
  ) {}

  @Post('replicas')
  async lookupReplicas(
    @Req() request: Request,
    @Body() body: LookupUserReplicasRequestDto,
  ) {
    assertInternalServiceAccess(request);
    return this.lookupUserReplicasUseCase.execute({
      userIds: body.userIds,
      username: body.username,
    });
  }
}

import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { LookupUserReplicasUseCase } from '../../application/use-cases/lookup-user-replicas.use-case';
import { LookupUserReplicasRequestDto } from './dto/lookup-user-replicas-request.dto';
import { assertInternalServiceAccess } from './internal-service-access';

@ApiTags('users-internal')
@ApiSecurity('service-jwt')
@ApiSecurity('internal-service-token')
@Controller('users/internal')
export class InternalUsersController {
  constructor(
    private readonly lookupUserReplicasUseCase: LookupUserReplicasUseCase,
  ) {}

  @Post('replicas')
  @ApiOperation({
    summary: 'Hydrate user replicas (S2S)',
    description:
      'Requires Service JWT (user.replicas.read, aud=user-service) or migration X-Internal-Service-Token. Not exposed via Traefik.',
  })
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

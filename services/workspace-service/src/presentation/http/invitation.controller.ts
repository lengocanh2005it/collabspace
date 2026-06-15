import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Headers,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  AcceptInvitationResponseSchemaDto,
  InvitationResponseSchemaDto,
  RejectInvitationResponseSchemaDto,
} from '../../application/dto/swagger-response.dto';
import type { Response } from 'express';
import { UserId } from './decorators/user-id.decorator';
import type { InviteMemberDto } from '../../application/dto/invite-member.dto';
import { InviteMemberUseCase } from '../../application/use-cases/invitation/invite-member.use-case';
import { AcceptInvitationUseCase } from '../../application/use-cases/invitation/accept-invitation.use-case';
import { RejectInvitationUseCase } from '../../application/use-cases/invitation/reject-invitation.use-case';
import { IdempotencyService } from '../../infrastructure/idempotency/idempotency.service';
import { AuthGuard } from './guards/auth.guard';
import { ListInvitationsUseCase } from '../../application/use-cases/invitation/list-invitations.use-case';

@ApiTags('invitations')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard)
export class InvitationController {
  constructor(
    private readonly inviteMemberUseCase: InviteMemberUseCase,
    private readonly acceptInvitationUseCase: AcceptInvitationUseCase,
    private readonly rejectInvitationUseCase: RejectInvitationUseCase,
    private readonly idempotencyService: IdempotencyService,
    private readonly listInvitationsUseCase: ListInvitationsUseCase,
  ) {}

  @Get('workspaces/:workspaceId/invitations')
  async listInvitations(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.listInvitationsUseCase.execute(userId, workspaceId);
  }

  @Post('workspaces/:workspaceId/invite')
  @ApiOperation({ summary: 'Invite member by email' })
  @ApiParam({ name: 'workspaceId', format: 'uuid' })
  @ApiCreatedResponse({ type: InvitationResponseSchemaDto })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Optional idempotency key (24h replay)',
  })
  async inviteMember(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: InviteMemberDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const route = `POST /workspaces/${workspaceId}/invite`;

    if (idempotencyKey?.trim()) {
      const cached = await this.idempotencyService.findCached(userId, idempotencyKey.trim());

      if (cached) {
        response.status(cached.statusCode);
        return cached.body;
      }
    }

    const result = await this.inviteMemberUseCase.execute(userId, workspaceId, dto);

    if (idempotencyKey?.trim()) {
      await this.idempotencyService.store(
        userId,
        idempotencyKey.trim(),
        route,
        201,
        result as unknown as Record<string, unknown>,
      );
      response.status(201);
    }

    return result;
  }

  @Post('invitations/:id/accept')
  @ApiOperation({ summary: 'Accept workspace invitation' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Invitation id' })
  @ApiOkResponse({ type: AcceptInvitationResponseSchemaDto })
  async acceptInvitation(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) invitationId: string,
  ) {
    return this.acceptInvitationUseCase.execute(userId, invitationId);
  }

  @Post('invitations/:id/reject')
  @ApiOperation({ summary: 'Reject workspace invitation' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Invitation id' })
  @ApiOkResponse({ type: RejectInvitationResponseSchemaDto })
  async rejectInvitation(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) invitationId: string,
  ) {
    return this.rejectInvitationUseCase.execute(userId, invitationId);
  }
}

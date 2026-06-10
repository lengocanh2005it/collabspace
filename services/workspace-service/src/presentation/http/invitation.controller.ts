import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Headers,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserId } from './decorators/user-id.decorator';
import { InviteMemberDto } from '../../application/dto/invite-member.dto';
import { InviteMemberUseCase } from '../../application/use-cases/invitation/invite-member.use-case';
import { AcceptInvitationUseCase } from '../../application/use-cases/invitation/accept-invitation.use-case';
import { RejectInvitationUseCase } from '../../application/use-cases/invitation/reject-invitation.use-case';
import { IdempotencyService } from '../../infrastructure/idempotency/idempotency.service';
import { UserIdGuard } from './guards/user-id.guard';

@Controller()
@UseGuards(UserIdGuard)
export class InvitationController {
  constructor(
    private readonly inviteMemberUseCase: InviteMemberUseCase,
    private readonly acceptInvitationUseCase: AcceptInvitationUseCase,
    private readonly rejectInvitationUseCase: RejectInvitationUseCase,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post('workspaces/:workspaceId/invite')
  async inviteMember(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: InviteMemberDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const route = `POST /workspaces/${workspaceId}/invite`;

    if (idempotencyKey?.trim()) {
      const cached = await this.idempotencyService.findCached(
        userId,
        idempotencyKey.trim(),
      );

      if (cached) {
        response.status(cached.statusCode);
        return cached.body;
      }
    }

    const result = await this.inviteMemberUseCase.execute(
      userId,
      workspaceId,
      dto,
    );

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
  async acceptInvitation(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) invitationId: string,
  ) {
    return this.acceptInvitationUseCase.execute(userId, invitationId);
  }

  @Post('invitations/:id/reject')
  async rejectInvitation(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) invitationId: string,
  ) {
    return this.rejectInvitationUseCase.execute(userId, invitationId);
  }
}

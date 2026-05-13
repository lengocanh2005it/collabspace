import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserId } from './decorators/user-id.decorator';
import { InviteMemberDto } from '../../application/dto/invite-member.dto';
import { InviteMemberUseCase } from '../../application/use-cases/invitation/invite-member.use-case';
import { AcceptInvitationUseCase } from '../../application/use-cases/invitation/accept-invitation.use-case';
import { RejectInvitationUseCase } from '../../application/use-cases/invitation/reject-invitation.use-case';
import { UserIdGuard } from './guards/user-id.guard';

@Controller()
@UseGuards(UserIdGuard)
export class InvitationController {
  constructor(
    private readonly inviteMemberUseCase: InviteMemberUseCase,
    private readonly acceptInvitationUseCase: AcceptInvitationUseCase,
    private readonly rejectInvitationUseCase: RejectInvitationUseCase,
  ) {}

  @Post('workspaces/:workspaceId/invite')
  async inviteMember(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.inviteMemberUseCase.execute(userId, workspaceId, dto);
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

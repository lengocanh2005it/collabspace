import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { InviteMemberDto } from '../../dto/invite-member.dto';
import {
  type IWorkspaceRepository,
  WORKSPACE_REPOSITORY,
} from '../../../domain/repositories/workspace.repository';
import {
  type IWorkspaceMemberRepository,
  WORKSPACE_MEMBER_REPOSITORY,
} from '../../../domain/repositories/workspace-member.repository';
import {
  type IInvitationRepository,
  INVITATION_REPOSITORY,
} from '../../../domain/repositories/invitation.repository';

@Injectable()
export class InviteMemberUseCase {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepo: IWorkspaceRepository,
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepo: IInvitationRepository,
  ) {}

  async execute(userId: string, workspaceId: string, dto: InviteMemberDto) {
    const member = await this.memberRepo.findByWorkspaceAndUser(
      workspaceId,
      userId,
    );
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new ForbiddenException('Only admins can invite members');
    }

    const workspace = await this.workspaceRepo.findById(workspaceId);

    return this.invitationRepo.createAndPublishInvited({
      workspaceId,
      inviterId: userId,
      inviteeEmail: dto.email,
      workspaceName: workspace?.name,
    });
  }
}

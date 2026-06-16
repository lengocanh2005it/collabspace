import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { InviteMemberDto } from '../../dto/invite-member.dto';
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
import {
  type IWorkspaceActivityRepository,
  WORKSPACE_ACTIVITY_REPOSITORY,
} from '../../../domain/repositories/workspace-activity.repository';
import { AuthHttpClient } from '../../../integrations/auth/auth-http.client';

function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isPlatformAdminAccount(roles: string[], permissions: string[]): boolean {
  return roles.includes('admin') || permissions.includes('auth.manage');
}

@Injectable()
export class InviteMemberUseCase {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaceRepo: IWorkspaceRepository,
    @Inject(INVITATION_REPOSITORY)
    private readonly invitationRepo: IInvitationRepository,
    @Inject(WORKSPACE_ACTIVITY_REPOSITORY)
    private readonly activityRepo: IWorkspaceActivityRepository,
    private readonly authHttpClient: AuthHttpClient,
  ) {}

  async execute(userId: string, workspaceId: string, dto: InviteMemberDto) {
    const member = await this.memberRepo.findByWorkspaceAndUser(workspaceId, userId);
    if (!member || (member.role !== 'owner' && member.role !== 'manager')) {
      throw new ForbiddenException('Only the workspace owner or manager can invite members');
    }

    const inviteeEmail = normalizeInviteEmail(dto.email);
    if (!inviteeEmail) {
      throw new BadRequestException({
        code: 'INVITE_EMAIL_REQUIRED',
        message: 'Email is required',
      });
    }

    const pendingInvite = await this.invitationRepo.findPendingByWorkspaceAndEmail(
      workspaceId,
      inviteeEmail,
    );
    if (pendingInvite) {
      throw new BadRequestException({
        code: 'INVITE_ALREADY_PENDING',
        message: 'An invitation is already pending for this email address.',
      });
    }

    const account = await this.authHttpClient.lookupAccountByEmail(inviteeEmail);
    if (account) {
      if (isPlatformAdminAccount(account.roles, account.permissions)) {
        throw new BadRequestException({
          code: 'INVITE_PLATFORM_ADMIN',
          message: 'Platform admin accounts cannot be invited to a workspace.',
        });
      }

      const existingMember = await this.memberRepo.findByWorkspaceAndUser(
        workspaceId,
        account.userId,
      );
      if (existingMember) {
        throw new BadRequestException({
          code: 'INVITE_ALREADY_MEMBER',
          message: 'This person is already a member of this workspace.',
        });
      }
    }

    const workspace = await this.workspaceRepo.findById(workspaceId);
    const invitation = await this.invitationRepo.createAndPublishInvited({
      workspaceId,
      inviterId: userId,
      inviteeEmail,
      workspaceName: workspace?.name,
    });

    await this.activityRepo.record({
      workspaceId,
      actorId: userId,
      actorName: null,
      type: 'member_invited',
      summary: `${inviteeEmail} was invited to the workspace`,
      meta: { inviteeEmail, invitationId: invitation.id },
    });

    return invitation;
  }
}

import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  type IWorkspaceMemberRepository,
  WORKSPACE_MEMBER_REPOSITORY,
} from '../../../domain/repositories/workspace-member.repository';

@Injectable()
export class ListMembersUseCase {
  constructor(
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
  ) {}

  async execute(userId: string, workspaceId: string) {
    const requestingMember = await this.memberRepo.findByWorkspaceAndUser(
      workspaceId,
      userId,
    );
    if (!requestingMember) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    return this.memberRepo.findByWorkspace(workspaceId);
  }
}

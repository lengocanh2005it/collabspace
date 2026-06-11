import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../../domain/repositories/project.repository';
import {
  type IWorkspaceMemberRepository,
  WORKSPACE_MEMBER_REPOSITORY,
} from '../../../domain/repositories/workspace-member.repository';

@Injectable()
export class ListProjectsUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepo: IProjectRepository,
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
  ) {}

  async execute(userId: string, workspaceId: string) {
    const member = await this.memberRepo.findByWorkspaceAndUser(
      workspaceId,
      userId,
    );
    if (!member) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    return this.projectRepo.findByWorkspace(workspaceId);
  }
}

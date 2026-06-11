import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../../domain/repositories/project.repository';
import {
  type IWorkspaceMemberRepository,
  WORKSPACE_MEMBER_REPOSITORY,
} from '../../../domain/repositories/workspace-member.repository';

@Injectable()
export class DeleteProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepo: IProjectRepository,
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
  ) {}

  async execute(userId: string, workspaceId: string, projectId: string) {
    const member = await this.memberRepo.findByWorkspaceAndUser(
      workspaceId,
      userId,
    );
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new ForbiddenException('Only admins or owners can delete projects');
    }

    const project = await this.projectRepo.findById(projectId, workspaceId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.projectRepo.softDelete(projectId, workspaceId);
    return { status: 'deleted' };
  }
}

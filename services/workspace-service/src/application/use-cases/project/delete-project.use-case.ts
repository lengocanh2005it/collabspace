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
import {
  type IWorkspaceActivityRepository,
  WORKSPACE_ACTIVITY_REPOSITORY,
} from '../../../domain/repositories/workspace-activity.repository';

@Injectable()
export class DeleteProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepo: IProjectRepository,
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
    @Inject(WORKSPACE_ACTIVITY_REPOSITORY)
    private readonly activityRepo: IWorkspaceActivityRepository,
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

    await this.activityRepo.record({
      workspaceId,
      actorId: userId,
      actorName: null,
      type: 'project_deleted',
      summary: `Project "${project.name}" was deleted`,
      meta: { projectId, projectName: project.name },
    });

    return { status: 'deleted' };
  }
}

import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { CreateProjectDto } from '../../dto/create-project.dto';
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
export class CreateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepo: IProjectRepository,
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
    @Inject(WORKSPACE_ACTIVITY_REPOSITORY)
    private readonly activityRepo: IWorkspaceActivityRepository,
  ) {}

  async execute(userId: string, workspaceId: string, dto: CreateProjectDto) {
    const member = await this.memberRepo.findByWorkspaceAndUser(workspaceId, userId);
    if (!member) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const project = await this.projectRepo.create({
      workspaceId,
      name: dto.name,
      description: dto.description,
      createdBy: userId,
    });

    await this.activityRepo.record({
      workspaceId,
      actorId: userId,
      actorName: null,
      type: 'project_created',
      summary: `Project "${project.name}" was created`,
      meta: { projectId: project.id, projectName: project.name },
    });

    return project;
  }
}

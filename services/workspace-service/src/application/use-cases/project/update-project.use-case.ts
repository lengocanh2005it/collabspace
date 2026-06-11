import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateProjectDto } from '../../dto/update-project.dto';
import {
  type IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../../domain/repositories/project.repository';
import {
  type IWorkspaceMemberRepository,
  WORKSPACE_MEMBER_REPOSITORY,
} from '../../../domain/repositories/workspace-member.repository';

@Injectable()
export class UpdateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepo: IProjectRepository,
    @Inject(WORKSPACE_MEMBER_REPOSITORY)
    private readonly memberRepo: IWorkspaceMemberRepository,
  ) {}

  async execute(
    userId: string,
    workspaceId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
    const member = await this.memberRepo.findByWorkspaceAndUser(
      workspaceId,
      userId,
    );
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new ForbiddenException('Only admins or owners can update projects');
    }

    const project = await this.projectRepo.findById(projectId, workspaceId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.projectRepo.update(projectId, workspaceId, {
      name: dto.name,
      description: dto.description,
    });
  }
}

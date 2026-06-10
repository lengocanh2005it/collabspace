import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectOrmEntity } from '../../../infrastructure/database/entities/project.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';

@Injectable()
export class DeleteProjectUseCase {
  constructor(
    @InjectRepository(ProjectOrmEntity)
    private readonly projectRepo: Repository<ProjectOrmEntity>,
    @InjectRepository(WorkspaceMemberOrmEntity)
    private readonly memberRepo: Repository<WorkspaceMemberOrmEntity>,
  ) {}

  async execute(userId: string, workspaceId: string, projectId: string) {
    const member = await this.memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new ForbiddenException('Only admins or owners can delete projects');
    }

    const project = await this.projectRepo.findOne({
      where: { id: projectId, workspace_id: workspaceId, is_deleted: false },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    project.is_deleted = true;
    await this.projectRepo.save(project);

    return { status: 'deleted' };
  }
}

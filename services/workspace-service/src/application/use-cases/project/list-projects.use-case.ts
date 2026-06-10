import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectOrmEntity } from '../../../infrastructure/database/entities/project.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';

@Injectable()
export class ListProjectsUseCase {
  constructor(
    @InjectRepository(ProjectOrmEntity)
    private readonly projectRepo: Repository<ProjectOrmEntity>,
    @InjectRepository(WorkspaceMemberOrmEntity)
    private readonly memberRepo: Repository<WorkspaceMemberOrmEntity>,
  ) {}

  async execute(userId: string, workspaceId: string) {
    const member = await this.memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    return this.projectRepo.find({
      where: { workspace_id: workspaceId, is_deleted: false },
    });
  }
}

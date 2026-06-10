import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectOrmEntity } from '../../../infrastructure/database/entities/project.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { CreateProjectDto } from '../../dto/create-project.dto';

@Injectable()
export class CreateProjectUseCase {
  constructor(
    @InjectRepository(ProjectOrmEntity)
    private readonly projectRepo: Repository<ProjectOrmEntity>,
    @InjectRepository(WorkspaceMemberOrmEntity)
    private readonly memberRepo: Repository<WorkspaceMemberOrmEntity>,
  ) {}

  async execute(userId: string, workspaceId: string, dto: CreateProjectDto) {
    const member = await this.memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const project = this.projectRepo.create({
      workspace_id: workspaceId,
      name: dto.name,
      description: dto.description,
      created_by: userId,
    });

    return this.projectRepo.save(project);
  }
}

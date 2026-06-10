import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';

@Injectable()
export class ListWorkspacesUseCase {
  constructor(
    @InjectRepository(WorkspaceOrmEntity)
    private readonly workspaceRepo: Repository<WorkspaceOrmEntity>,
  ) {}

  async execute(userId: string) {
    const workspaces = await this.workspaceRepo
      .createQueryBuilder('workspace')
      .innerJoin('workspace.members', 'member', 'member.user_id = :userId', {
        userId,
      })
      .getMany();

    return workspaces;
  }
}

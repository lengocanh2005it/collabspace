import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';
import { CreateWorkspaceDto } from '../../dto/create-workspace.dto';

@Injectable()
export class CreateWorkspaceUseCase {
  constructor(
    @InjectRepository(WorkspaceOrmEntity)
    private readonly workspaceRepo: Repository<WorkspaceOrmEntity>,
    @InjectRepository(WorkspaceMemberOrmEntity)
    private readonly memberRepo: Repository<WorkspaceMemberOrmEntity>,
  ) {}

  async execute(userId: string, dto: CreateWorkspaceDto) {
    // Start transaction
    return this.workspaceRepo.manager.transaction(async (manager) => {
      const workspace = manager.create(WorkspaceOrmEntity, {
        name: dto.name,
        description: dto.description,
        owner_id: userId,
      });

      const savedWorkspace = await manager.save(workspace);

      const member = manager.create(WorkspaceMemberOrmEntity, {
        workspace_id: savedWorkspace.id,
        user_id: userId,
        role: 'owner',
      });

      await manager.save(member);

      return savedWorkspace;
    });
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';

@Injectable()
export class GetWorkspaceUseCase {
  constructor(
    @InjectRepository(WorkspaceOrmEntity)
    private readonly workspaceRepo: Repository<WorkspaceOrmEntity>,
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

    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }
}

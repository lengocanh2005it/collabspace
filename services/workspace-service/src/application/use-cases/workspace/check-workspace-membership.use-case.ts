import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceOrmEntity } from '../../../infrastructure/database/entities/workspace.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';

export type WorkspaceMembershipResult = {
  workspaceId: string;
  userId: string;
  isMember: boolean;
  role: string | null;
};

@Injectable()
export class CheckWorkspaceMembershipUseCase {
  constructor(
    @InjectRepository(WorkspaceOrmEntity)
    private readonly workspaceRepo: Repository<WorkspaceOrmEntity>,
    @InjectRepository(WorkspaceMemberOrmEntity)
    private readonly memberRepo: Repository<WorkspaceMemberOrmEntity>,
  ) {}

  async execute(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipResult> {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const member = await this.memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });

    return {
      workspaceId,
      userId,
      isMember: Boolean(member),
      role: member?.role ?? null,
    };
  }
}

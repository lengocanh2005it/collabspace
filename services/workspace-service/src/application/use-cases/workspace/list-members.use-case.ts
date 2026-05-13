import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';

@Injectable()
export class ListMembersUseCase {
  constructor(
    @InjectRepository(WorkspaceMemberOrmEntity)
    private readonly memberRepo: Repository<WorkspaceMemberOrmEntity>,
  ) {}

  async execute(userId: string, workspaceId: string) {
    const requestingMember = await this.memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });

    if (!requestingMember) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    return this.memberRepo.find({
      where: { workspace_id: workspaceId },
    });
  }
}

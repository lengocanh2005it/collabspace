import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvitationOrmEntity } from '../../../infrastructure/database/entities/invitation.orm-entity';
import { WorkspaceMemberOrmEntity } from '../../../infrastructure/database/entities/workspace-member.orm-entity';

@Injectable()
export class ListInvitationsUseCase {
  constructor(
    @InjectRepository(InvitationOrmEntity)
    private readonly invitationRepo: Repository<InvitationOrmEntity>,
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

    return this.invitationRepo.find({
      where: { workspace_id: workspaceId, status: 'pending' },
      order: { created_at: 'DESC' },
    });
  }
}
